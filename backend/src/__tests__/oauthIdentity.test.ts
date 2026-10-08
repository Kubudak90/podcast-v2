import { describe, expect, it } from 'vitest';
import { readAppleIdentity, readGoogleUserInfo } from '../lib/oauthIdentity.js';

describe('readGoogleUserInfo', () => {
  it('accepts a verified address', () => {
    const result = readGoogleUserInfo({
      sub: 'sub-1',
      email: 'ada@example.com',
      email_verified: true,
      name: 'Ada',
      picture: 'https://example.com/a.png',
    });
    expect(result).toEqual({
      ok: true,
      profile: {
        sub: 'sub-1',
        email: 'ada@example.com',
        name: 'Ada',
        picture: 'https://example.com/a.png',
      },
    });
  });

  it('accepts email_verified as the string true', () => {
    const result = readGoogleUserInfo({
      sub: 'sub-1',
      email: 'ada@example.com',
      email_verified: 'true',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unverified address', () => {
    expect(
      readGoogleUserInfo({
        sub: 'sub-1',
        email: 'ada@example.com',
        email_verified: false,
      }),
    ).toEqual({ ok: false, reason: 'unverified' });
  });

  it('rejects a missing verification claim', () => {
    expect(readGoogleUserInfo({ sub: 'sub-1', email: 'ada@example.com' })).toEqual({
      ok: false,
      reason: 'unverified',
    });
  });

  it('rejects a payload without an email', () => {
    expect(readGoogleUserInfo({ sub: 'sub-1', email_verified: true })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('trims the subject and email', () => {
    const result = readGoogleUserInfo({
      sub: ' sub-1 ',
      email: ' ada@example.com ',
      email_verified: true,
    });
    expect(result).toEqual({
      ok: true,
      profile: { sub: 'sub-1', email: 'ada@example.com', name: undefined, picture: undefined },
    });
  });
});

describe('readAppleIdentity', () => {
  it('accepts a later sign-in that omits email', () => {
    expect(readAppleIdentity({ sub: 'apple-1' })).toEqual({
      ok: true,
      profile: { sub: 'apple-1' },
    });
  });

  it('accepts a verified email sent as a string', () => {
    expect(
      readAppleIdentity({
        sub: 'apple-1',
        email: 'ada@example.com',
        email_verified: 'true',
      }),
    ).toEqual({
      ok: true,
      profile: { sub: 'apple-1', email: 'ada@example.com' },
    });
  });

  it('rejects an unverified email', () => {
    expect(
      readAppleIdentity({
        sub: 'apple-1',
        email: 'ada@example.com',
        email_verified: 'false',
      }),
    ).toEqual({ ok: false, reason: 'unverified' });
  });

  it('rejects a missing subject', () => {
    expect(readAppleIdentity({ email: 'ada@example.com', email_verified: true })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
