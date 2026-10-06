import { describe, expect, it } from 'vitest';
import { shouldServeAppShell } from '../lib/appShell';

describe('app shell navigation', () => {
  it('serves client routes', () => {
    expect(shouldServeAppShell('/')).toBe(true);
    expect(shouldServeAppShell('/login')).toBe(true);
    expect(shouldServeAppShell('/room/abc')).toBe(true);
    expect(shouldServeAppShell('/room/abc/ended')).toBe(true);
    expect(shouldServeAppShell('/listen/share-slug')).toBe(true);
    expect(shouldServeAppShell('/profile?tab=activity')).toBe(true);
  });

  it('leaves API, socket, health, and real files to the network', () => {
    expect(shouldServeAppShell('/api')).toBe(false);
    expect(shouldServeAppShell('/api/rooms')).toBe(false);
    expect(shouldServeAppShell('/api/legal/terms')).toBe(false);
    expect(shouldServeAppShell('/api?x=1')).toBe(false);
    expect(shouldServeAppShell('/socket.io/?EIO=4')).toBe(false);
    expect(shouldServeAppShell('/health')).toBe(false);
    expect(shouldServeAppShell('/icon-192.png')).toBe(false);
    expect(shouldServeAppShell('/icon-maskable-512.png?v=1')).toBe(false);
    expect(shouldServeAppShell('/manifest.json')).toBe(false);
    expect(shouldServeAppShell('/assets/index-abc123.js')).toBe(false);
  });

  it('does not treat similar path names as denied', () => {
    expect(shouldServeAppShell('/apples')).toBe(true);
    expect(shouldServeAppShell('/healthy-rooms')).toBe(true);
  });
});
