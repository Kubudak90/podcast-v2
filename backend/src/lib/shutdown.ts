export const SHUTDOWN_TIMEOUT_MS = 8_000;

export type ShutdownSignal = 'SIGTERM' | 'SIGINT';

export interface ShutdownLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

export interface ShutdownTargets {
  /** Stop accepting new HTTP connections. Resolves when existing ones finish. */
  closeHttp: () => Promise<void>;
  /** Disconnect Socket.IO clients so closeHttp can finish. */
  closeSocket: () => void | Promise<void>;
  /** Drop idle keep-alive sockets after the socket server is closed. */
  closeIdleConnections?: () => void;
  /** Used only when shutdown exceeds the timeout. */
  closeAllConnections?: () => void;
  disconnectDb: () => Promise<void>;
}

export interface ShutdownOptions {
  targets: ShutdownTargets;
  log: ShutdownLogger;
  exit: (code: number) => void;
  timeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

export type SignalSubscriber = (signal: ShutdownSignal, listener: () => void) => void;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown shutdown error';
}

/**
 * Registers SIGTERM and SIGINT. The returned function runs the same sequence
 * so tests can invoke it without sending a real signal. A second call while
 * one is in progress returns the same promise.
 */
export function installShutdownHandlers(
  options: ShutdownOptions,
  subscribe: SignalSubscriber = (signal, listener) => {
    process.on(signal, listener);
  },
): (signal?: ShutdownSignal) => Promise<void> {
  const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let running: Promise<void> | null = null;

  const perform = (signal: ShutdownSignal): Promise<void> => {
    options.log.info({ signal }, 'Shutting down');

    let settled = false;
    const timer = setTimer(() => {
      try {
        options.targets.closeAllConnections?.();
      } catch (error) {
        options.log.error(
          { signal, message: errorMessage(error) },
          'Failed to close remaining connections',
        );
      }
      options.log.error({ signal }, 'Shutdown timed out');
      finish(1);
    }, timeoutMs);

    function finish(code: number): void {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      options.exit(code);
    }

    const work = (async () => {
      let failed = false;
      const note = (error: unknown, step: string) => {
        failed = true;
        options.log.error({ signal, step, message: errorMessage(error) }, 'Shutdown step failed');
      };

      let httpClosed: Promise<void>;
      try {
        httpClosed = Promise.resolve(options.targets.closeHttp()).catch((error: unknown) => {
          note(error, 'http');
        });
      } catch (error) {
        note(error, 'http');
        httpClosed = Promise.resolve();
      }

      try {
        await options.targets.closeSocket();
      } catch (error) {
        note(error, 'socket');
      }

      try {
        options.targets.closeIdleConnections?.();
      } catch (error) {
        note(error, 'idle');
      }

      await httpClosed;

      try {
        await options.targets.disconnectDb();
      } catch (error) {
        note(error, 'database');
      }

      if (settled) return;

      if (failed) {
        options.log.error({ signal }, 'Shutdown failed');
        finish(1);
        return;
      }

      options.log.info({ signal }, 'Shutdown complete');
      finish(0);
    })();

    return work;
  };

  const run = (signal: ShutdownSignal = 'SIGTERM'): Promise<void> => {
    if (running) return running;
    running = perform(signal);
    return running;
  };

  subscribe('SIGTERM', () => {
    void run('SIGTERM');
  });
  subscribe('SIGINT', () => {
    void run('SIGINT');
  });

  return run;
}
