import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { unsubscribeFromPushApi } = vi.hoisted(() => ({
  unsubscribeFromPushApi: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    unsubscribeFromPush: unsubscribeFromPushApi,
  },
}));

import { unsubscribeFromPush } from '../lib/push';

const ENDPOINT = 'https://push.example/sub/1';

function installSubscription(unsubscribe: ReturnType<typeof vi.fn> | null) {
  const subscription = unsubscribe
    ? { endpoint: ENDPOINT, unsubscribe }
    : null;
  const getSubscription = vi.fn().mockResolvedValue(subscription);

  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    writable: true,
    value: function PushManager() {},
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription },
      }),
    },
  });

  return { getSubscription };
}

describe('unsubscribeFromPush', () => {
  beforeEach(() => {
    unsubscribeFromPushApi.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'PushManager');
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('deletes the server row before the browser subscription', async () => {
    const order: string[] = [];
    const unsubscribe = vi.fn(async () => {
      order.push('local');
      return true;
    });
    unsubscribeFromPushApi.mockImplementation(async () => {
      order.push('server');
      return { message: 'ok' };
    });
    installSubscription(unsubscribe);

    await expect(unsubscribeFromPush()).resolves.toBe(true);

    expect(order).toEqual(['server', 'local']);
    expect(unsubscribeFromPushApi).toHaveBeenCalledWith(ENDPOINT);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('keeps the browser subscription when the server delete fails', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    unsubscribeFromPushApi.mockRejectedValue(new Error('Internal server error'));
    installSubscription(unsubscribe);

    await expect(unsubscribeFromPush()).resolves.toBe(false);

    expect(unsubscribeFromPushApi).toHaveBeenCalledWith(ENDPOINT);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('returns false when the browser unsubscribe fails after the server delete', async () => {
    const unsubscribe = vi.fn().mockRejectedValue(new Error('unsubscribe failed'));
    unsubscribeFromPushApi.mockResolvedValue({ message: 'ok' });
    installSubscription(unsubscribe);

    await expect(unsubscribeFromPush()).resolves.toBe(false);

    expect(unsubscribeFromPushApi).toHaveBeenCalledWith(ENDPOINT);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('does nothing when the browser has no subscription', async () => {
    installSubscription(null);

    await expect(unsubscribeFromPush()).resolves.toBe(true);

    expect(unsubscribeFromPushApi).not.toHaveBeenCalled();
  });

  it('returns false when push is not supported', async () => {
    Reflect.deleteProperty(window, 'PushManager');

    await expect(unsubscribeFromPush()).resolves.toBe(false);

    expect(unsubscribeFromPushApi).not.toHaveBeenCalled();
  });
});
