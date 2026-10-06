import { describe, expect, it, vi } from 'vitest';
import { disableMicrophone, enableMicrophoneWhenAllowed, micIntentForRole } from '../lib/micRole';

describe('micIntentForRole', () => {
  it('enables the mic for speakers and hosts', () => {
    expect(micIntentForRole('speaker')).toBe('enable');
    expect(micIntentForRole('host')).toBe('enable');
  });

  it('disables the mic for listeners', () => {
    expect(micIntentForRole('listener')).toBe('disable');
  });

  it('ignores unknown roles', () => {
    expect(micIntentForRole('guest')).toBeNull();
  });
});

describe('enableMicrophoneWhenAllowed', () => {
  it('turns the mic on once publishing is allowed', async () => {
    let canPublish = false;
    const calls: boolean[] = [];

    const result = await enableMicrophoneWhenAllowed({
      canPublish: () => canPublish,
      setEnabled: async (enabled) => {
        calls.push(enabled);
      },
      sleep: async () => {
        canPublish = true;
      },
      attempts: 4,
      delayMs: 1,
    });

    expect(result).toBe('enabled');
    expect(calls).toEqual([true]);
  });

  it('refreshes the token once when the grant is late, then publishes', async () => {
    let canPublish = false;
    const refresh = vi.fn(async () => {
      canPublish = true;
    });

    const result = await enableMicrophoneWhenAllowed({
      canPublish: () => canPublish,
      setEnabled: async () => {
        if (!canPublish) throw new Error('publish blocked');
      },
      refreshPermission: refresh,
      sleep: async () => {},
      attempts: 6,
      refreshAfterAttempt: 2,
    });

    expect(result).toBe('enabled');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops waiting when a newer role change cancels the job', async () => {
    let cancelled = false;
    const setEnabled = vi.fn(async () => {});

    const result = await enableMicrophoneWhenAllowed({
      canPublish: () => false,
      setEnabled,
      isCancelled: () => cancelled,
      sleep: async () => {
        cancelled = true;
      },
      attempts: 3,
    });

    expect(result).toBe('cancelled');
    expect(setEnabled).not.toHaveBeenCalled();
  });

  it('does not report success if the role changed while the mic was opening', async () => {
    let cancelled = false;
    const result = await enableMicrophoneWhenAllowed({
      canPublish: () => true,
      setEnabled: async () => {
        cancelled = true;
      },
      isCancelled: () => cancelled,
      attempts: 2,
    });

    expect(result).toBe('cancelled');
  });

  it('retries when the first publish attempt throws', async () => {
    let tries = 0;
    const result = await enableMicrophoneWhenAllowed({
      canPublish: () => true,
      setEnabled: async () => {
        tries += 1;
        if (tries === 1) throw new Error('not ready');
      },
      sleep: async () => {},
      attempts: 3,
    });

    expect(result).toBe('enabled');
    expect(tries).toBe(2);
  });

  it('gives up when publishing never becomes allowed', async () => {
    const result = await enableMicrophoneWhenAllowed({
      canPublish: () => false,
      setEnabled: async () => {},
      sleep: async () => {},
      attempts: 3,
    });

    expect(result).toBe('unavailable');
  });
});

describe('disableMicrophone', () => {
  it('turns the mic off', async () => {
    const calls: boolean[] = [];
    const result = await disableMicrophone(async (enabled) => {
      calls.push(enabled);
    });
    expect(result).toBe('disabled');
    expect(calls).toEqual([false]);
  });

  it('reports failure when unpublish throws', async () => {
    const result = await disableMicrophone(async () => {
      throw new Error('disconnected');
    });
    expect(result).toBe('unavailable');
  });
});
