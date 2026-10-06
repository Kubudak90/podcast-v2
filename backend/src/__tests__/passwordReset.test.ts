import { describe, it, expect, afterEach } from 'vitest';
import { buildResetUrl, hashResetToken, generateResetToken } from '../lib/passwordReset.js';
import { devResetLinkEnabled, isSmtpConfigured } from '../lib/mail.js';

describe('password reset helpers', () => {
  const previous = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_FROM: process.env.SMTP_FROM,
    PASSWORD_RESET_DEV_LINK: process.env.PASSWORD_RESET_DEV_LINK,
    NODE_ENV: process.env.NODE_ENV,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('hashes tokens without keeping the raw value', () => {
    const token = generateResetToken();
    expect(token.length).toBeGreaterThan(20);
    expect(hashResetToken(token)).toHaveLength(64);
    expect(hashResetToken(token)).not.toContain(token);
    expect(hashResetToken(token)).toBe(hashResetToken(token));
  });

  it('builds a frontend reset url', () => {
    process.env.FRONTEND_URL = 'https://podchat.example.com/';
    const url = new URL(buildResetUrl('abc'));
    expect(url.origin).toBe('https://podchat.example.com');
    expect(url.pathname).toBe('/reset-password');
    expect(url.searchParams.get('token')).toBe('abc');
  });

  it('treats SMTP as configured only when host and from are set', () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    expect(isSmtpConfigured()).toBe(false);
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'PodChat <noreply@example.com>';
    expect(isSmtpConfigured()).toBe(true);
  });

  it('keeps the dev reset link out of production', () => {
    process.env.PASSWORD_RESET_DEV_LINK = '1';
    process.env.NODE_ENV = 'test';
    expect(devResetLinkEnabled()).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(devResetLinkEnabled()).toBe(false);
  });
});
