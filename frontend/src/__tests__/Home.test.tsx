import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from '../pages/Home';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('../lib/api', () => ({
  api: {
    getPublicRooms: vi.fn(),
    joinRoom: vi.fn(),
  },
}));

const getUserMedia = vi.fn();

const liveRoom = {
  id: 'room-1',
  slug: 'friday',
  title: 'Friday Talk',
  status: 'live' as const,
  isPublic: true,
  hasPassword: false,
  host: { id: 'host-1', username: 'ada', avatarUrl: undefined },
  participantCount: 3,
  maxSpeakers: 10,
  createdAt: new Date().toISOString(),
};

describe('Home join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    useAuthStore.getState().setAuth(
      { id: 'user-1', username: 'listener', createdAt: new Date().toISOString() },
      'token',
    );
    vi.mocked(api.getPublicRooms).mockResolvedValue({
      rooms: [liveRoom],
      total: 1,
      limit: 20,
      offset: 0,
    });
    vi.mocked(api.joinRoom).mockResolvedValue({
      room: {
        id: 'room-1',
        slug: 'friday',
        title: 'Friday Talk',
        hostId: 'host-1',
        host: { id: 'host-1', username: 'ada', avatarUrl: undefined },
        status: 'live',
        maxSpeakers: 10,
        isPublic: true,
        hasPassword: false,
        createdAt: new Date().toISOString(),
      },
      participant: { role: 'listener' },
    });
  });

  it('joins a public room without asking for a microphone', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Friday Talk/ }));

    await waitFor(() => {
      expect(api.joinRoom).toHaveBeenCalledWith('friday');
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/room/friday');
  });

  it('joins a password room without asking for a microphone', async () => {
    vi.mocked(api.getPublicRooms).mockResolvedValue({
      rooms: [{ ...liveRoom, hasPassword: true }],
      total: 1,
      limit: 20,
      offset: 0,
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Friday Talk/ }));
    expect(await screen.findByPlaceholderText('Sifre girin')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Sifre girin'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'KATIL' }));

    await waitFor(() => {
      expect(api.joinRoom).toHaveBeenCalledWith('friday', 'secret');
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/room/friday');
  });
});
