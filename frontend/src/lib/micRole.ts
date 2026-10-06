export type MicRoleIntent = 'enable' | 'disable';

export function micIntentForRole(role: string): MicRoleIntent | null {
  if (role === 'speaker' || role === 'host') return 'enable';
  if (role === 'listener') return 'disable';
  return null;
}

export interface EnableMicOptions {
  canPublish: () => boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  isCancelled?: () => boolean;
  /** Ask the server for a token that includes the new publish grant. */
  refreshPermission?: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
  delayMs?: number;
  /** Zero-based attempt index at which a single token refresh is requested. */
  refreshAfterAttempt?: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Turn the mic on after LiveKit has applied canPublish.
 * The socket role event often arrives before the permission update, so this polls briefly.
 */
export async function enableMicrophoneWhenAllowed(
  options: EnableMicOptions,
): Promise<'enabled' | 'cancelled' | 'unavailable'> {
  const attempts = options.attempts ?? 10;
  const delayMs = options.delayMs ?? 200;
  const refreshAfter = options.refreshAfterAttempt ?? 3;
  const sleep = options.sleep ?? defaultSleep;
  const isCancelled = options.isCancelled ?? (() => false);
  let refreshed = false;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (isCancelled()) return 'cancelled';

    if (
      !options.canPublish() &&
      !refreshed &&
      options.refreshPermission &&
      attempt === refreshAfter
    ) {
      refreshed = true;
      try {
        await options.refreshPermission();
      } catch {
        // The RoomService permission push may still arrive.
      }
      if (isCancelled()) return 'cancelled';
    }

    if (options.canPublish()) {
      try {
        await options.setEnabled(true);
        return isCancelled() ? 'cancelled' : 'enabled';
      } catch {
        // The grant flag can flip before publish is actually allowed.
      }
    }

    if (attempt < attempts - 1) await sleep(delayMs);
  }

  return isCancelled() ? 'cancelled' : 'unavailable';
}

export async function disableMicrophone(
  setEnabled: (enabled: boolean) => Promise<void>,
): Promise<'disabled' | 'unavailable'> {
  try {
    await setEnabled(false);
    return 'disabled';
  } catch {
    return 'unavailable';
  }
}
