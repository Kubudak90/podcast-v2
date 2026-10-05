import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserProfile } from '../pages/UserProfile';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import type { UserProfile as UserProfileData } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    getUserProfile: vi.fn(),
    getUserPodcasts: vi.fn(),
    getBlockedIds: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    createReport: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
  },
}));

vi.mock('../components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockApi = api as unknown as {
  getUserProfile: ReturnType<typeof vi.fn>;
  getUserPodcasts: ReturnType<typeof vi.fn>;
  getBlockedIds: ReturnType<typeof vi.fn>;
  blockUser: ReturnType<typeof vi.fn>;
  createReport: ReturnType<typeof vi.fn>;
};

const other: UserProfileData = {
  id: 'other',
  username: 'Bora',
  bio: 'Merhaba',
  createdAt: '2026-01-01T00:00:00.000Z',
  followerCount: 8,
  followingCount: 2,
  roomCount: 1,
  isFollowing: false,
};

function renderUser(userId = 'other') {
  return render(
    <MemoryRouter initialEntries={[`/u/${userId}`]}>
      <Routes>
        <Route path="/u/:userId" element={<UserProfile />} />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: 'me', username: 'Ada', createdAt: '2026-01-01T00:00:00.000Z' },
      token: 'token',
      isAuthenticated: true,
    });
    mockApi.getUserProfile.mockResolvedValue(other);
    mockApi.getUserPodcasts.mockResolvedValue({
      podcasts: [{
        id: 'rec-1',
        ownerId: 'other',
        coverImageUrl: null,
        title: 'Gece Sohbeti',
        isPublic: true,
        shareSlug: 'gece',
        durationSeconds: 65,
        playCount: 3,
        createdAt: '2026-03-01T00:00:00.000Z',
      }],
    });
    mockApi.getBlockedIds.mockResolvedValue({ blockedIds: [] });
  });

  it('shows the profile, a podcast, and moderation actions', async () => {
    renderUser();
    expect(await screen.findByRole('heading', { name: 'Bora' })).toBeInTheDocument();
    expect(screen.getByText('Merhaba')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gece Sohbeti/ })).toHaveAttribute('href', '/listen/gece');
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Engelle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bildir' })).toBeInTheDocument();
  });

  it('blocks the user after confirmation', async () => {
    mockApi.blockUser.mockResolvedValue({ message: 'Blocked' });
    renderUser();
    fireEvent.click(await screen.findByRole('button', { name: 'Engelle' }));
    const confirms = screen.getAllByRole('button', { name: 'Engelle' });
    fireEvent.click(confirms[confirms.length - 1]);
    await waitFor(() => expect(mockApi.blockUser).toHaveBeenCalledWith('other'));
    expect(await screen.findByRole('button', { name: 'Engeli kaldir' })).toBeInTheDocument();
  });

  it('submits a user report', async () => {
    mockApi.createReport.mockResolvedValue({ message: 'Report received' });
    renderUser();
    fireEvent.click(await screen.findByRole('button', { name: 'Bildir' }));
    fireEvent.change(screen.getByLabelText('Sebep'), { target: { value: 'harassment' } });
    fireEvent.change(screen.getByLabelText(/Not/), { target: { value: 'rahatsiz edici' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gonder' }));
    await waitFor(() => {
      expect(mockApi.createReport).toHaveBeenCalledWith({
        targetType: 'user',
        targetId: 'other',
        reason: 'harassment',
        note: 'rahatsiz edici',
      });
    });
  });

  it('hides moderation actions on your own profile', async () => {
    mockApi.getUserProfile.mockResolvedValue({ ...other, id: 'me', username: 'Ada', isFollowing: false });
    renderUser('me');
    expect(await screen.findByRole('link', { name: 'Profilini duzenle' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('button', { name: 'Engelle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bildir' })).not.toBeInTheDocument();
  });

  it('shows a not-found state', async () => {
    mockApi.getUserProfile.mockRejectedValue(new Error('User not found'));
    renderUser();
    expect(await screen.findByText('Kullanici bulunamadi')).toBeInTheDocument();
  });
});
