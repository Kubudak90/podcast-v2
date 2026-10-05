import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSpeakerRequests } from '../hooks/useSpeakerRequests';
import { useAuthStore } from '../lib/store';

const mockEmit = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    getSpeakerRequests: vi.fn(),
    changeRole: vi.fn(),
  },
}));

vi.mock('../lib/socket', () => ({
  requestToSpeak: vi.fn(),
  rejectSpeakerRequest: vi.fn(),
  connectSocket: vi.fn(() => ({ emit: mockEmit })),
}));

vi.mock('../components/Toast', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { api } from '../lib/api';
import { rejectSpeakerRequest, requestToSpeak } from '../lib/socket';
import { toast } from '../components/Toast';

describe('useSpeakerRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useAuthStore.getState().setAuth(
        { id: 'user-1', username: 'listener', createdAt: new Date().toISOString() },
        'token',
      );
    });
    vi.mocked(api.getSpeakerRequests).mockResolvedValue({ requests: [] });
    vi.mocked(api.changeRole).mockResolvedValue(undefined);
  });

  it('loads pending requests for the host', async () => {
    vi.mocked(api.getSpeakerRequests).mockResolvedValue({
      requests: [{
        userId: 'user-2',
        username: 'ada',
        avatarUrl: null,
        requestedAt: '2026-10-05T00:00:00.000Z',
      }],
    });

    const { result } = renderHook(() => useSpeakerRequests('room-1', true));

    await waitFor(() => {
      expect(result.current.requests).toHaveLength(1);
    });
    expect(result.current.requests[0].username).toBe('ada');
  });

  it('does not fetch requests for a listener', () => {
    renderHook(() => useSpeakerRequests('room-1', false));
    expect(api.getSpeakerRequests).not.toHaveBeenCalled();
  });

  it('raises a hand once and ignores a second click', () => {
    const { result } = renderHook(() => useSpeakerRequests('room-1', false));

    act(() => {
      result.current.raiseHand();
      result.current.raiseHand();
    });

    expect(requestToSpeak).toHaveBeenCalledTimes(1);
    expect(requestToSpeak).toHaveBeenCalledWith('room-1');
    expect(result.current.requestPending).toBe(true);
  });

  it('clears a pending hand when the host rejects it', () => {
    const { result } = renderHook(() => useSpeakerRequests('room-1', false));

    act(() => {
      result.current.raiseHand();
    });
    act(() => {
      result.current.onSpeakerRequestResolved({ userId: 'user-1', accepted: false });
    });

    expect(result.current.requestPending).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('Konusma istegi reddedildi');
  });

  it('shows the server error and clears the pending hand', () => {
    const { result } = renderHook(() => useSpeakerRequests('room-1', false));

    act(() => {
      result.current.raiseHand();
    });
    act(() => {
      result.current.onSpeakerRequestResolved({
        userId: 'user-1',
        accepted: false,
        error: 'Yayin sona erdi',
      });
    });

    expect(result.current.requestPending).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Yayin sona erdi');
  });

  it('accepts a request by promoting the listener', async () => {
    const { result } = renderHook(() => useSpeakerRequests('room-1', true));

    act(() => {
      result.current.onSpeakerRequested({
        userId: 'user-2',
        username: 'ada',
        requestedAt: '2026-10-05T00:00:00.000Z',
      });
    });

    await act(async () => {
      await result.current.acceptRequest('user-2');
    });

    expect(api.changeRole).toHaveBeenCalledWith('room-1', 'user-2', 'speaker');
    expect(result.current.requests).toHaveLength(0);
  });

  it('declines a request over the socket', () => {
    const { result } = renderHook(() => useSpeakerRequests('room-1', true));

    act(() => {
      result.current.onSpeakerRequested({
        userId: 'user-2',
        username: 'ada',
        requestedAt: '2026-10-05T00:00:00.000Z',
      });
    });
    act(() => {
      result.current.declineRequest('user-2');
    });

    expect(rejectSpeakerRequest).toHaveBeenCalledWith('room-1', 'user-2');
    expect(result.current.requests).toHaveLength(0);
  });
});
