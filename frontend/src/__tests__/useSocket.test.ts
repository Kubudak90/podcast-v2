import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSocket } from '../hooks/useSocket';
import * as socketLib from '../lib/socket';
import { useAuthStore } from '../lib/store';

// Mock socket.io
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
  emit: vi.fn(),
};

vi.mock('../lib/socket', () => ({
  connectSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
  joinRoomChannel: vi.fn(),
  leaveRoomChannel: vi.fn(),
  getSocket: vi.fn(() => mockSocket),
}));

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set authenticated state
    act(() => {
      useAuthStore.getState().setAuth(
        { id: 'user-1', username: 'testuser', createdAt: new Date().toISOString() },
        'test-token'
      );
    });
  });

  it('should connect socket when authenticated', () => {
    renderHook(() => useSocket());
    expect(socketLib.connectSocket).toHaveBeenCalled();
  });

  it('should not connect socket when not authenticated', () => {
    act(() => {
      useAuthStore.getState().logout();
    });

    renderHook(() => useSocket());
    expect(socketLib.connectSocket).not.toHaveBeenCalled();
  });

  it('should join room channel when roomSlug provided', () => {
    renderHook(() => useSocket({ roomSlug: 'test-room' }));
    expect(socketLib.joinRoomChannel).toHaveBeenCalledWith('test-room');
  });

  it('should leave room channel on unmount', () => {
    const { unmount } = renderHook(() => useSocket({ roomSlug: 'test-room' }));
    unmount();
    expect(socketLib.leaveRoomChannel).toHaveBeenCalledWith('test-room');
  });

  it('should register room:update listener', () => {
    renderHook(() => useSocket());
    expect(mockSocket.on).toHaveBeenCalledWith('room:update', expect.any(Function));
  });

  it('should unregister room:update listener on unmount', () => {
    const { unmount } = renderHook(() => useSocket());
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith('room:update', expect.any(Function));
  });

  it('should call onParticipantJoined when participant joins', () => {
    const onParticipantJoined = vi.fn();
    renderHook(() => useSocket({ onParticipantJoined }));

    // Get the registered handler
    const handler = mockSocket.on.mock.calls.find((call) => call[0] === 'room:update')?.[1];

    act(() => {
      handler?.({
        type: 'participant_joined',
        payload: { userId: 'user-2', username: 'other', role: 'speaker' },
      });
    });

    expect(onParticipantJoined).toHaveBeenCalledWith({
      userId: 'user-2',
      username: 'other',
      role: 'speaker',
    });
  });

  it('should call onStatusChanged when room status changes', () => {
    const onStatusChanged = vi.fn();
    renderHook(() => useSocket({ onStatusChanged }));

    const handler = mockSocket.on.mock.calls.find((call) => call[0] === 'room:update')?.[1];

    act(() => {
      handler?.({
        type: 'status_changed',
        payload: { status: 'live', isRecording: true },
      });
    });

    expect(onStatusChanged).toHaveBeenCalledWith({ status: 'live', isRecording: true });
  });

  it('should call onRoleChanged when role changes', () => {
    const onRoleChanged = vi.fn();
    renderHook(() => useSocket({ onRoleChanged }));

    const handler = mockSocket.on.mock.calls.find((call) => call[0] === 'room:update')?.[1];

    act(() => {
      handler?.({
        type: 'participant_role_changed',
        payload: { userId: 'user-1', role: 'listener' },
      });
    });

    expect(onRoleChanged).toHaveBeenCalledWith({ userId: 'user-1', role: 'listener' });
  });

  it('should call onRecordingError on recording_stopped event', () => {
    const onRecordingError = vi.fn();
    renderHook(() => useSocket({ onRecordingError }));

    const handler = mockSocket.on.mock.calls.find((call) => call[0] === 'room:update')?.[1];

    act(() => {
      handler?.({
        type: 'recording_stopped',
        payload: { error: 'Kayit baslatilamadi' },
      });
    });

    expect(onRecordingError).toHaveBeenCalledWith({ error: 'Kayit baslatilamadi' });
  });

  it('should call onParticipantLeft when participant leaves', () => {
    const onParticipantLeft = vi.fn();
    renderHook(() => useSocket({ onParticipantLeft }));

    const handler = mockSocket.on.mock.calls.find((call) => call[0] === 'room:update')?.[1];

    act(() => {
      handler?.({
        type: 'participant_left',
        payload: { userId: 'user-2' },
      });
    });

    expect(onParticipantLeft).toHaveBeenCalledWith({ userId: 'user-2' });
  });

  it('should provide disconnect function', () => {
    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.disconnect();
    });

    expect(socketLib.disconnectSocket).toHaveBeenCalled();
  });
});
