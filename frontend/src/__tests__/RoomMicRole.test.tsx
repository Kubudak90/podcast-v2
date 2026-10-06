import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Room } from '../pages/Room';
import { ToastContainer } from '../components/Toast';
import { api } from '../lib/api';
import { useAuthStore, useRoomStore } from '../lib/store';
import type { Room as RoomType } from '../types';

const socketHandlers: {
  onRoleChanged?: (payload: { userId: string; role: string }) => void;
} = {};

const localParticipant = {
  identity: 'ada',
  isMicrophoneEnabled: false,
  permissions: { canPublish: true },
  setMicrophoneEnabled: vi.fn(async (enabled: boolean) => {
    localParticipant.isMicrophoneEnabled = enabled;
  }),
};

vi.mock('../hooks/useSocket', () => ({
  useSocket: (options: { onRoleChanged?: (payload: { userId: string; role: string }) => void }) => {
    socketHandlers.onRoleChanged = options.onRoleChanged;
    return { socket: null, disconnect: vi.fn() };
  },
}));

vi.mock('../lib/api', () => ({
  api: {
    joinRoom: vi.fn(),
    getLiveKitToken: vi.fn(),
    setToken: vi.fn(),
    leaveRoom: vi.fn(),
  },
}));

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  RoomAudioRenderer: () => null,
  useParticipants: () => [],
  useLocalParticipant: () => ({ localParticipant }),
  useTracks: () => [],
}));

vi.mock('livekit-client', () => ({
  Track: { Source: { Microphone: 'microphone' } },
}));

const room: RoomType = {
  id: 'room-1',
  slug: 'abc123',
  title: 'Friday Talk',
  hostId: 'host-1',
  status: 'live',
  maxSpeakers: 10,
  isPublic: true,
  hasPassword: false,
  createdAt: '2026-10-06T00:00:00.000Z',
  startedAt: '2026-10-06T00:00:00.000Z',
};

function renderRoom() {
  return render(
    <>
      <MemoryRouter initialEntries={['/room/abc123']}>
        <Routes>
          <Route path="/room/:slug" element={<Room />} />
        </Routes>
      </MemoryRouter>
      <ToastContainer />
    </>,
  );
}

describe('Room microphone on role change', () => {
  beforeEach(() => {
    socketHandlers.onRoleChanged = undefined;
    localParticipant.isMicrophoneEnabled = false;
    localParticipant.permissions.canPublish = true;
    localParticipant.setMicrophoneEnabled.mockClear();
    useAuthStore.setState({
      user: { id: 'user-1', username: 'ada', createdAt: '2026-10-06T00:00:00.000Z' },
      token: 'token',
      isAuthenticated: true,
    });
    useRoomStore.setState({
      currentRoom: null,
      currentRoomPassword: null,
      isHost: false,
      isSpeaker: false,
      isMuted: true,
    });
    vi.mocked(api.getLiveKitToken).mockResolvedValue({
      token: 'livekit-token',
      url: 'ws://localhost:7880',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
  });

  it('shows the mic control for someone who joined as a speaker', async () => {
    vi.mocked(api.joinRoom).mockResolvedValue({ room, participant: { role: 'speaker' } });

    renderRoom();

    expect(await screen.findByRole('button', { name: 'Mikrofonu ac' })).toHaveTextContent('MIC OFF');
    expect(screen.queryByRole('button', { name: 'REQUEST' })).not.toBeInTheDocument();
  });

  it('opens the microphone after the host promotes a listener', async () => {
    vi.mocked(api.joinRoom).mockResolvedValue({ room, participant: { role: 'listener' } });

    renderRoom();

    expect(await screen.findByRole('button', { name: 'REQUEST' })).toBeInTheDocument();

    socketHandlers.onRoleChanged?.({ userId: 'user-1', role: 'speaker' });

    await waitFor(() => {
      expect(localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    });
    expect(await screen.findByRole('button', { name: 'Mikrofonu kapat' })).toHaveTextContent('MIC ON');
    expect(await screen.findByText('Mikrofon acildi')).toBeInTheDocument();
  });

  it('closes the microphone when the speaker is moved back to the audience', async () => {
    vi.mocked(api.joinRoom).mockResolvedValue({ room, participant: { role: 'speaker' } });

    renderRoom();
    await screen.findByRole('button', { name: 'Mikrofonu ac' });

    socketHandlers.onRoleChanged?.({ userId: 'user-1', role: 'listener' });

    await waitFor(() => {
      expect(localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    });
    expect(await screen.findByRole('button', { name: 'REQUEST' })).toBeInTheDocument();
  });
});
