import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Profile } from '../pages/Profile';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { toast } from '../components/Toast';
import type { RoomHistoryItem, UserProfile } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    getRoomHistory: vi.fn(),
    getUserProfile: vi.fn(),
    getFollowers: vi.fn(),
    getFollowing: vi.fn(),
    deleteAccount: vi.fn(),
    setToken: vi.fn(),
    legalPageUrl: (page: string) => `http://localhost:3001/api/legal/${page}`,
    updateProfile: vi.fn(),
  },
}));

vi.mock('../components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockApi = api as unknown as {
  getRoomHistory: ReturnType<typeof vi.fn>;
  getUserProfile: ReturnType<typeof vi.fn>;
  getFollowers: ReturnType<typeof vi.fn>;
  getFollowing: ReturnType<typeof vi.fn>;
  deleteAccount: ReturnType<typeof vi.fn>;
  setToken: ReturnType<typeof vi.fn>;
};

function room(id: string, joinedAt: string, role: RoomHistoryItem['role'] = 'listener'): RoomHistoryItem {
  return {
    id,
    slug: id,
    title: `Room ${id}`,
    status: 'ended',
    isPublic: true,
    host: { id: 'host', username: 'host' },
    participantCount: 1,
    recordingCount: 0,
    role,
    joinedAt,
    leftAt: joinedAt,
    createdAt: joinedAt,
  };
}

const profile: UserProfile = {
  id: 'me',
  username: 'Ada',
  createdAt: '2026-01-01T00:00:00.000Z',
  followerCount: 12,
  followingCount: 4,
  roomCount: 1,
  isFollowing: false,
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<div>home-page</div>} />
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/u/:userId" element={<div>user-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    useAuthStore.setState({
      user: { id: 'me', username: 'Ada', createdAt: '2026-01-01T00:00:00.000Z' },
      token: 'token',
      isAuthenticated: true,
    });
    mockApi.getUserProfile.mockResolvedValue(profile);
    mockApi.getRoomHistory.mockResolvedValue([]);
    mockApi.getFollowers.mockResolvedValue([]);
    mockApi.getFollowing.mockResolvedValue([]);
  });

  it('shows real follower and following counts', async () => {
    renderProfile();
    expect(screen.queryByText('1.2K')).not.toBeInTheDocument();
    expect(screen.queryByText('342')).not.toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('opens the follower list', async () => {
    mockApi.getFollowers.mockResolvedValue([
      { id: 'bob', username: 'Bob', followedAt: '2026-02-01T00:00:00.000Z', bio: 'hi' },
    ]);
    renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Takipciler' }));
    expect(await screen.findByRole('link', { name: /Bob/ })).toHaveAttribute('href', '/u/bob');
  });

  it('filters activity to this week', async () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    mockApi.getRoomHistory.mockResolvedValue([
      room('new', recent, 'host'),
      room('old', old, 'host'),
    ]);
    renderProfile();
    await screen.findByText('12');
    await waitFor(() => {
      expect(screen.getByText('Rooms Hosted').previousElementSibling).toHaveTextContent('2');
    });
    fireEvent.click(screen.getByRole('button', { name: 'This week' }));
    expect(screen.getByText('Rooms Hosted').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('expands the room list', async () => {
    const recent = new Date().toISOString();
    mockApi.getRoomHistory.mockResolvedValue([
      room('a', recent),
      room('b', recent),
      room('c', recent),
      room('d', recent),
    ]);
    renderProfile();
    await screen.findByText('Room a');
    expect(screen.queryByText('Room d')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'See all' }));
    expect(screen.getByText('Room d')).toBeInTheDocument();
  });

  it('opens notification and privacy settings', async () => {
    renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    expect(await screen.findByText('Push Notifications')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Privacy/ }));
    const privacy = screen.getByRole('link', { name: /Gizlilik politikasi/ });
    expect(privacy).toHaveAttribute('href', 'http://localhost:3001/api/legal/privacy');
    expect(screen.getByRole('link', { name: /Kullanim kosullari/ })).toHaveAttribute('href', 'http://localhost:3001/api/legal/terms');
  });

  it('deletes the account after the username is confirmed', async () => {
    mockApi.deleteAccount.mockResolvedValue({ message: 'Account deleted' });
    renderProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Account' }));
    const confirm = screen.getByRole('button', { name: 'Hesabi sil' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Kullanici adini onayla'), { target: { value: 'Ada' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockApi.deleteAccount).toHaveBeenCalledOnce();
    });
    expect(mockApi.setToken).toHaveBeenCalledWith(null);
    expect(toast.success).toHaveBeenCalledWith('Hesap silindi');
    expect(screen.getByText('home-page')).toBeInTheDocument();
  });
});
