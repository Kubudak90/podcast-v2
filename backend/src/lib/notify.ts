import { logError } from './logger.js';

// Fire-and-forget moderation alert to the operator (ntfy topic URL via env). No-op if unset.
export async function notifyModeration(message: string): Promise<void> {
  const url = process.env.MODERATION_NTFY_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', body: message, headers: { Title: 'PodChat moderation' } });
  } catch (error) {
    logError(error as Error, { action: 'notify_moderation' });
  }
}
