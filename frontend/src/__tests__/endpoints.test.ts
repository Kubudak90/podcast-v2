import { describe, it, expect } from 'vitest';
import { resolveApiBase, resolveSocketOrigin } from '../lib/endpoints';

describe('resolveApiBase', () => {
  it('keeps a base that already ends with /api', () => {
    expect(resolveApiBase('http://localhost:3001/api')).toBe('http://localhost:3001/api');
  });

  it('adds /api when the value is only the site origin', () => {
    expect(resolveApiBase('https://podchat.example.com')).toBe('https://podchat.example.com/api');
  });

  it('strips a trailing slash before deciding', () => {
    expect(resolveApiBase('https://podchat.example.com/')).toBe('https://podchat.example.com/api');
    expect(resolveApiBase('http://localhost:3001/api/')).toBe('http://localhost:3001/api');
  });

  it('uses the local API default when unset', () => {
    expect(resolveApiBase()).toBe('http://localhost:3001/api');
    expect(resolveApiBase('   ')).toBe('http://localhost:3001/api');
  });
});

describe('resolveSocketOrigin', () => {
  it('prefers VITE_SOCKET_URL', () => {
    expect(resolveSocketOrigin('https://podchat.example.com/api', 'http://localhost:3001')).toBe(
      'http://localhost:3001',
    );
  });

  it('strips /api from the socket URL so the default namespace is used', () => {
    expect(resolveSocketOrigin(undefined, 'http://localhost:3001/api/')).toBe('http://localhost:3001');
  });

  it('derives the origin from an API base that includes /api', () => {
    expect(resolveSocketOrigin('http://localhost:3001/api')).toBe('http://localhost:3001');
  });

  it('keeps a site origin that has no /api suffix', () => {
    expect(resolveSocketOrigin('https://podchat.example.com')).toBe('https://podchat.example.com');
  });

  it('falls back to the local backend origin', () => {
    expect(resolveSocketOrigin()).toBe('http://localhost:3001');
  });
});
