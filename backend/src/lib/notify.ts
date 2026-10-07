import { logError } from './logger.js';

const NOTIFY_TIMEOUT_MS = 4_000;

// Fire-and-forget moderation alert to the operator (ntfy topic URL via env). No-op if unset.
export async function notifyModeration(message: string): Promise<void> {
  const url = process.env.MODERATION_NTFY_URL;
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: message,
      headers: { Title: 'PodChat moderation' },
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      logError(new Error(`Moderation notify failed with HTTP ${response.status}`), {
        action: 'notify_moderation',
        status: response.status,
      });
    }

    try {
      await response.body?.cancel();
    } catch {
      // A stuck body must not replace the status already recorded.
    }
  } catch (error) {
    const asError = error instanceof Error ? error : new Error('Moderation notify failed');
    logError(asError, { action: 'notify_moderation' });
  }
}
