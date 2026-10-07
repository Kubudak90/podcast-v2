import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  installShutdownHandlers,
  type ShutdownOptions,
  type ShutdownSignal,
} from '../lib/shutdown.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function harness(overrides: Partial<ShutdownOptions['targets']> = {}) {
  const order: string[] = [];
  const exit = vi.fn();
  const log = {
    info: vi.fn(),
    error: vi.fn(),
  };
  let releaseHttp: () => void = () => {};
  const targets: ShutdownOptions['targets'] = {
    closeHttp: () => {
      order.push('http-start');
      return new Promise((resolve) => {
        releaseHttp = () => {
          order.push('http-end');
          resolve();
        };
      });
    },
    closeSocket: () => {
      order.push('socket');
    },
    closeIdleConnections: () => {
      order.push('idle');
      releaseHttp();
    },
    closeAllConnections: () => {
      order.push('all');
    },
    disconnectDb: () => {
      order.push('db');
      return Promise.resolve();
    },
    ...overrides,
  };

  const signals: ShutdownSignal[] = [];
  const run = installShutdownHandlers(
    {
      targets,
      log,
      exit,
      setTimer: () => 1 as unknown as ReturnType<typeof setTimeout>,
      clearTimer: () => {},
    },
    (signal) => {
      signals.push(signal);
    },
  );

  return { order, exit, log, signals, run, releaseHttp: () => releaseHttp() };
}

describe('installShutdownHandlers', () => {
  it('drains HTTP after sockets drop, then disconnects the database', async () => {
    const { order, exit, log, run } = harness();

    await run('SIGTERM');

    expect(order).toEqual(['http-start', 'socket', 'idle', 'http-end', 'db']);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(log.info).toHaveBeenCalledWith({ signal: 'SIGTERM' }, 'Shutdown complete');
    expect(log.error).not.toHaveBeenCalled();
  });

  it('subscribes to SIGTERM and SIGINT', () => {
    const { signals } = harness();
    expect(signals).toEqual(['SIGTERM', 'SIGINT']);
  });

  it('runs the sequence once when a second signal arrives', async () => {
    let calls = 0;
    const { exit, run } = harness({
      closeHttp: () => {
        calls += 1;
        return Promise.resolve();
      },
      closeIdleConnections: () => {},
    });

    await Promise.all([run('SIGTERM'), run('SIGINT')]);

    expect(calls).toBe(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('exits 1 when HTTP close fails and still disconnects the database', async () => {
    const { order, exit, log, run } = harness({
      closeHttp: () => Promise.reject(new Error('http down')),
      closeIdleConnections: () => {
        order.push('idle');
      },
    });

    await run('SIGTERM');

    expect(order).toContain('db');
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(log.error).toHaveBeenCalledWith(
      { signal: 'SIGTERM', step: 'http', message: 'http down' },
      'Shutdown step failed',
    );
  });

  it('exits 1 when the socket server fails and still waits for HTTP', async () => {
    const { order, exit, run } = harness({
      closeSocket: () => {
        order.push('socket');
        throw new Error('socket down');
      },
    });

    await run('SIGINT');

    expect(order).toEqual(['http-start', 'socket', 'idle', 'http-end', 'db']);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('exits 1 when the database disconnect fails', async () => {
    const { exit, log, run } = harness({
      disconnectDb: () => Promise.reject(new Error('db down')),
    });

    await run('SIGTERM');

    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(log.error).toHaveBeenCalledWith(
      { signal: 'SIGTERM', step: 'database', message: 'db down' },
      'Shutdown step failed',
    );
  });

  it('forces remaining connections closed when shutdown exceeds the timeout', async () => {
    let fire: (() => void) | undefined;
    const exit = vi.fn();
    const closeAllConnections = vi.fn();
    let releaseHttp: () => void = () => {};

    const run = installShutdownHandlers(
      {
        targets: {
          closeHttp: () =>
            new Promise((resolve) => {
              releaseHttp = resolve;
            }),
          closeSocket: () => {},
          closeAllConnections,
          disconnectDb: () => Promise.resolve(),
        },
        log: { info: vi.fn(), error: vi.fn() },
        exit,
        setTimer: (fn) => {
          fire = fn;
          return 1 as unknown as ReturnType<typeof setTimeout>;
        },
        clearTimer: () => {
          fire = undefined;
        },
      },
      () => {},
    );

    const pending = run('SIGTERM');
    fire?.();
    expect(closeAllConnections).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);

    releaseHttp();
    await pending;
    expect(exit).toHaveBeenCalledOnce();
  });

  it('still exits 1 when forcing connections closed throws', async () => {
    let fire: (() => void) | undefined;
    const exit = vi.fn();
    const log = { info: vi.fn(), error: vi.fn() };

    const run = installShutdownHandlers(
      {
        targets: {
          closeHttp: () => new Promise(() => {}),
          closeSocket: () => {},
          closeAllConnections: () => {
            throw new Error('close all failed');
          },
          disconnectDb: () => Promise.resolve(),
        },
        log,
        exit,
        setTimer: (fn) => {
          fire = fn;
          return 1 as unknown as ReturnType<typeof setTimeout>;
        },
        clearTimer: () => {},
      },
      () => {},
    );

    void run('SIGTERM');
    fire?.();

    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(log.error).toHaveBeenCalledWith(
      { signal: 'SIGTERM', message: 'close all failed' },
      'Failed to close remaining connections',
    );
  });
});

describe('index shutdown wiring', () => {
  it('stops the HTTP server, Socket.IO, and Prisma on process signals', () => {
    const source = readFileSync(join(root, 'src/index.ts'), 'utf8');

    expect(source).toContain('installShutdownHandlers');
    expect(source).toContain('httpServer.close');
    expect(source).toContain('getIO().close');
    expect(source).toContain('closeIdleConnections');
    expect(source).toContain('closeAllConnections');
    expect(source).toContain('prisma.$disconnect');
  });
});
