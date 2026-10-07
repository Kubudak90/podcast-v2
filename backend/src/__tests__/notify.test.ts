import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/logger.js', () => ({
  logError: vi.fn(),
}));

import { logError } from '../lib/logger.js';
import { notifyModeration } from '../lib/notify.js';

const logErrorMock = vi.mocked(logError);

describe('notifyModeration', () => {
  const originalUrl = process.env.MODERATION_NTFY_URL;

  beforeEach(() => {
    logErrorMock.mockReset();
    delete process.env.MODERATION_NTFY_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalUrl === undefined) delete process.env.MODERATION_NTFY_URL;
    else process.env.MODERATION_NTFY_URL = originalUrl;
  });

  it('does nothing when the ntfy URL is unset', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await notifyModeration('Report: room x');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('posts the message with a 4s abort signal', async () => {
    process.env.MODERATION_NTFY_URL = 'https://ntfy.example/podchat';
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await notifyModeration('Report: recording abc');

    expect(timeout).toHaveBeenCalledWith(4_000);
    expect(fetchMock).toHaveBeenCalledWith('https://ntfy.example/podchat', {
      method: 'POST',
      body: 'Report: recording abc',
      headers: { Title: 'PodChat moderation' },
      signal: expect.any(AbortSignal),
    });
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('logs a non-2xx status without the report text or topic URL', async () => {
    process.env.MODERATION_NTFY_URL = 'https://ntfy.example/podchat-secret';
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret body', { status: 503 })));

    await notifyModeration('Report: private note');

    expect(logErrorMock).toHaveBeenCalledTimes(1);
    const [error, context] = logErrorMock.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('503');
    expect(error.message).not.toContain('private note');
    expect(JSON.stringify(context)).not.toContain('private note');
    expect(JSON.stringify(context)).not.toContain('ntfy.example');
    expect(context).toEqual({ action: 'notify_moderation', status: 503 });
  });

  it('logs network failures and still resolves', async () => {
    process.env.MODERATION_NTFY_URL = 'https://ntfy.example/podchat';
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal);
    const failure = new TypeError('fetch failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));

    await expect(notifyModeration('Report: room')).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith(failure, { action: 'notify_moderation' });
  });

  it('logs a timeout abort and still resolves', async () => {
    process.env.MODERATION_NTFY_URL = 'https://ntfy.example/podchat';
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      setTimeout(() => {
        controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
      }, 0);
      return controller.signal;
    });
    vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error('missing abort signal'));
          return;
        }
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });

    await expect(notifyModeration('Report: room')).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    const [error, context] = logErrorMock.mock.calls[0];
    expect(error).toBeInstanceOf(DOMException);
    expect(error.name).toBe('TimeoutError');
    expect(context).toEqual({ action: 'notify_moderation' });
  });
});
