import { createHash, randomBytes } from 'node:crypto';

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function buildResetUrl(token: string): string {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${frontend}/reset-password?token=${encodeURIComponent(token)}`;
}
