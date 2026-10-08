import { describe, expect, it, vi } from 'vitest';
import { clientInAppScope, notificationTargetPath, openNotificationTarget } from '../lib/notificationNav';

const scope = 'https://podchat.test/';

describe('notificationTargetPath', () => {
  it('opens a live room when the slug is a room code', () => {
    expect(notificationTargetPath({ type: 'room_live', roomSlug: 'abc12345' })).toBe('/room/abc12345');
  });

  it('opens the profile for a new follower', () => {
    expect(notificationTargetPath({ type: 'new_follower' })).toBe('/profile');
  });

  it('stays on the home page when the payload is missing or the slug is not a room code', () => {
    expect(notificationTargetPath(undefined)).toBe('/');
    expect(notificationTargetPath(null)).toBe('/');
    expect(notificationTargetPath({ type: 'room_live', roomSlug: '../admin' })).toBe('/');
    expect(notificationTargetPath({ type: 'room_live', roomSlug: 'https://evil.test' })).toBe('/');
    expect(notificationTargetPath({ type: 'room_live', roomSlug: '//evil.test' })).toBe('/');
    expect(notificationTargetPath({ type: 'room_live' })).toBe('/');
    expect(notificationTargetPath({ type: 'other', roomSlug: 'abc12345' })).toBe('/');
  });
});

describe('clientInAppScope', () => {
  it('accepts pages on this origin and rejects other sites', () => {
    expect(clientInAppScope('https://podchat.test/room/abc', scope)).toBe(true);
    expect(clientInAppScope('https://evil.test/?next=https://podchat.test/', scope)).toBe(false);
    expect(clientInAppScope('https://podchat.test.evil.test/', scope)).toBe(false);
  });
});

describe('openNotificationTarget', () => {
  it('waits until the open tab has navigated', async () => {
    let finishNavigation: (value: unknown) => void = () => {};
    const navigate = vi.fn(
      () =>
        new Promise((resolve) => {
          finishNavigation = resolve;
        }),
    );
    const focus = vi.fn(() => Promise.resolve());
    const openWindow = vi.fn();

    const pending = openNotificationTarget(
      { type: 'room_live', roomSlug: 'abc12345' },
      {
        matchAll: async () => [{ url: 'https://podchat.test/library', focus, navigate }],
        openWindow,
      },
      scope,
    );

    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/room/abc12345');
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();

    finishNavigation(null);
    await pending;
    expect(settled).toBe(true);
  });

  it('opens a new window when no tab is in scope', async () => {
    const openWindow = vi.fn(async () => null);
    await openNotificationTarget(
      { type: 'new_follower' },
      {
        matchAll: async () => [{ url: 'https://evil.test/', focus: vi.fn(), navigate: vi.fn() }],
        openWindow,
      },
      scope,
    );
    expect(openWindow).toHaveBeenCalledWith('/profile');
  });

  it('opens a new window when the existing tab cannot navigate', async () => {
    const openWindow = vi.fn(async () => null);
    await openNotificationTarget(
      { type: 'room_live', roomSlug: 'abc12345' },
      {
        matchAll: async () => [
          {
            url: 'https://podchat.test/',
            focus: () => Promise.resolve(),
            navigate: () => Promise.reject(new Error('navigate failed')),
          },
        ],
        openWindow,
      },
      scope,
    );
    expect(openWindow).toHaveBeenCalledWith('/room/abc12345');
  });
});
