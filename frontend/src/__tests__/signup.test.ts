import { describe, it, expect } from 'vitest';
import { legalPageUrl, normalizeUsername, signupPayload, validateSignup } from '../lib/signup';

const valid = {
  username: 'ada',
  email: 'ada@example.com',
  password: 'secret1',
  confirmPassword: 'secret1',
  agreeTerms: true,
};

describe('validateSignup', () => {
  it('accepts a complete account', () => {
    expect(validateSignup(valid)).toBeNull();
  });

  it('strips a leading @ from the username before checking length', () => {
    expect(validateSignup({ ...valid, username: '@ab' })).toBeNull();
    expect(normalizeUsername('  @@ada  ')).toBe('ada');
  });

  it('rejects a username shorter than 2 characters', () => {
    expect(validateSignup({ ...valid, username: '@a' })).toBe('username_short');
  });

  it('rejects spaces and other symbols in the username', () => {
    expect(validateSignup({ ...valid, username: 'ada lovelace' })).toBe('username_chars');
  });

  it('rejects an incomplete email', () => {
    expect(validateSignup({ ...valid, email: 'ada@' })).toBe('email_invalid');
  });

  it('rejects a password shorter than 6 characters', () => {
    expect(validateSignup({ ...valid, password: '12345', confirmPassword: '12345' })).toBe('password_short');
  });

  it('rejects mismatched passwords', () => {
    expect(validateSignup({ ...valid, confirmPassword: 'secret2' })).toBe('password_mismatch');
  });

  it('rejects the form until terms are accepted', () => {
    expect(validateSignup({ ...valid, agreeTerms: false })).toBe('terms_required');
  });

  it('builds the payload only after the form is valid', () => {
    expect(signupPayload({ ...valid, username: '@Ada_1' })).toEqual({
      username: 'Ada_1',
      email: 'ada@example.com',
      password: 'secret1',
    });
    expect(signupPayload({ ...valid, password: 'short', confirmPassword: 'short' })).toBeNull();
  });
});

describe('legalPageUrl', () => {
  it('points terms and privacy at the API legal pages', () => {
    expect(legalPageUrl('terms', 'http://localhost:3001/api')).toBe('http://localhost:3001/api/legal/terms');
    expect(legalPageUrl('privacy', 'http://localhost:3001/api/')).toBe('http://localhost:3001/api/legal/privacy');
  });
});
