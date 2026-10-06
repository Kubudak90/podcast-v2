import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoomContent } from '../pages/Room';
import { useAuthStore, useRoomStore } from '../lib/store';
import type { Room } from '../types';

const { getRoom, muteParticipant, removeParticipant, requestUnmute, livekit } = vi.hoisted(() => {
  const localParticipant = {
    identity: 'host',
    isMicrophoneEnabled: true,
    setMicrophoneEnabled: vi.fn(),
  };
  const participants = [
    { identity: 'host', isMicrophoneEnabled: true },
    { identity: 'ada', isMicrophoneEnabled: true },
  ];
  return {
    getRoom: vi.fn(),
    muteParticipant: vi.fn(),
    removeParticipant: vi.fn(),
    requestUnmute: vi.fn(),
    livekit: { localParticipant, participants },
  };
});

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children }: { children: ReactNode }) => children,
  RoomAudioRenderer: () => null,
  useParticipants: () => livekit.participants,
  useLocalParticipant: () => ({ localParticipant: livekit.localParticipant }),
  useTracks: () => [],
}));

vi.mock('../lib/api', () => ({
  api: {
    getRoom,
    muteParticipant,
    unmuteParticipant: vi.fn(),
    removeParticipant,
    leaveRoom: vi.fn(),
    startRoom: vi.fn(),
    endRoom: vi.fn(),
  },
}));

vi.mock('../lib/socket', () => ({
  requestUnmute,
  getSocket: () => null,
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ socket: null, disconnect: vi.fn() }),
}));

const room: Room = {
  id: 'room-1',
  slug: 'abc',
  title: 'Friday',
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
    <MemoryRouter initialEntries={['/room/abc']}>
      <Routes>
        <Route path="/room/abc" element={<RoomContent room={room} onLocalRemoved={vi.fn()} />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Room host moderation', () => {
  beforeEach(() => {
    getRoom.mockResolvedValue({
      participants: [
        { id: 'p-host', userId: 'host-1', username: 'host', role: 'host', mutedByHost: false },
        { id: 'p-ada', userId: 'user-2', username: 'ada', role: 'speaker', mutedByHost: false },
      ],
    });
    muteParticipant.mockResolvedValue(undefined);
    removeParticipant.mockResolvedValue(undefined);
    useAuthStore.getState().setAuth(
      { id: 'host-1', username: 'host', createdAt: '2026-10-06T00:00:00.000Z' },
      'token'
    );
    useRoomStore.getState().setIsHost(true);
    useRoomStore.getState().setIsSpeaker(true);
  });

  it('lets the host mute a speaker from the tile', async () => {
    renderRoom();

    const manageButtons = await screen.findAllByRole('button', { name: 'MANAGE' });
    fireEvent.click(manageButtons[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'MUTE' }));

    await waitFor(() => {
      expect(muteParticipant).toHaveBeenCalledWith('abc', 'user-2');
    });
  });

  it('asks the muted speaker to request the mic back', async () => {
    useAuthStore.getState().setAuth(
      { id: 'user-2', username: 'ada', createdAt: '2026-10-06T00:00:00.000Z' },
      'token'
    );
    useRoomStore.getState().setIsHost(false);
    useRoomStore.getState().setIsSpeaker(true);
    getRoom.mockResolvedValue({
      participants: [
        { id: 'p-ada', userId: 'user-2', username: 'ada', role: 'speaker', mutedByHost: true },
      ],
    });

    renderRoom();

    fireEvent.click(await screen.findByRole('button', { name: 'ASK TO SPEAK' }));
    expect(requestUnmute).toHaveBeenCalledWith('abc');
    expect(await screen.findByRole('button', { name: 'REQUESTED' })).toBeInTheDocument();
  });
});
