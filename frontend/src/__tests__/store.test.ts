import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, useRoomStore } from '../lib/store';
import { act } from '@testing-library/react';

describe('Store Tests', () => {
  describe('useAuthStore', () => {
    beforeEach(() => {
      // Reset auth store
      act(() => {
        useAuthStore.getState().logout();
      });
    });

    it('should have initial state', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should set auth state', () => {
      const user = { id: 'user-1', username: 'testuser', createdAt: new Date().toISOString() };
      const token = 'test-token';

      act(() => {
        useAuthStore.getState().setAuth(user, token);
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.token).toBe(token);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should update user', () => {
      const user = { id: 'user-1', username: 'testuser', createdAt: new Date().toISOString() };
      const updatedUser = { ...user, username: 'newusername', bio: 'Hello!' };

      act(() => {
        useAuthStore.getState().setAuth(user, 'token');
        useAuthStore.getState().updateUser(updatedUser);
      });

      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });

    it('should logout and clear state', () => {
      const user = { id: 'user-1', username: 'testuser', createdAt: new Date().toISOString() };

      act(() => {
        useAuthStore.getState().setAuth(user, 'token');
        useAuthStore.getState().logout();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('useRoomStore', () => {
    beforeEach(() => {
      // Reset room store
      act(() => {
        useRoomStore.getState().reset();
      });
    });

    it('should have initial state', () => {
      const state = useRoomStore.getState();
      expect(state.currentRoom).toBeNull();
      expect(state.isHost).toBe(false);
      expect(state.isSpeaker).toBe(false);
      expect(state.isMuted).toBe(true); // reset sets isMuted to true
    });

    it('should set current room', () => {
      const room = {
        id: 'room-1',
        slug: 'abc123',
        title: 'Test Room',
        hostId: 'host-1',
        status: 'waiting' as const,
        isPublic: true,
        hasPassword: false,
        maxSpeakers: 10,
        createdAt: new Date().toISOString(),
      };

      act(() => {
        useRoomStore.getState().setCurrentRoom(room);
      });

      expect(useRoomStore.getState().currentRoom).toEqual(room);
    });

    it('should set isHost', () => {
      act(() => {
        useRoomStore.getState().setIsHost(true);
      });

      expect(useRoomStore.getState().isHost).toBe(true);
    });

    it('should set isSpeaker', () => {
      act(() => {
        useRoomStore.getState().setIsSpeaker(true);
      });

      expect(useRoomStore.getState().isSpeaker).toBe(true);
    });

    it('should set isMuted', () => {
      act(() => {
        useRoomStore.getState().setIsMuted(false);
      });

      expect(useRoomStore.getState().isMuted).toBe(false);
    });

    it('should toggle mute', () => {
      act(() => {
        useRoomStore.getState().setIsMuted(false);
        useRoomStore.getState().toggleMute();
      });

      expect(useRoomStore.getState().isMuted).toBe(true);

      act(() => {
        useRoomStore.getState().toggleMute();
      });

      expect(useRoomStore.getState().isMuted).toBe(false);
    });

    it('should reset all state', () => {
      const room = {
        id: 'room-1',
        slug: 'abc123',
        title: 'Test Room',
        hostId: 'host-1',
        status: 'live' as const,
        isPublic: true,
        hasPassword: false,
        maxSpeakers: 10,
        createdAt: new Date().toISOString(),
      };

      act(() => {
        useRoomStore.getState().setCurrentRoom(room);
        useRoomStore.getState().setIsHost(true);
        useRoomStore.getState().setIsSpeaker(true);
        useRoomStore.getState().setIsMuted(false);
      });

      // Verify state is set
      expect(useRoomStore.getState().currentRoom).not.toBeNull();
      expect(useRoomStore.getState().isHost).toBe(true);

      act(() => {
        useRoomStore.getState().reset();
      });

      const state = useRoomStore.getState();
      expect(state.currentRoom).toBeNull();
      expect(state.isHost).toBe(false);
      expect(state.isSpeaker).toBe(false);
      expect(state.isMuted).toBe(true);
    });
  });
});
