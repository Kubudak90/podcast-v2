import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Library } from '../pages/Library';
import { api } from '../lib/api';
import type { UserPodcast } from '../types';

const navigate = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: { id: 'user-1', username: 'ada' } as { id: string; username: string } | null,
  isAuthenticated: true,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../lib/store', () => ({
  useAuthStore: () => authState,
}));

vi.mock('../lib/api', () => ({
  api: {
    getUserPodcasts: vi.fn(),
    getRecordingDownloadUrl: vi.fn(),
  },
}));

const podcasts: UserPodcast[] = [
  {
    id: 'rec-new',
    ownerId: 'user-1',
    coverImageUrl: null,
    title: 'Yeni Kayit',
    isPublic: true,
    shareSlug: 'yeni',
    durationSeconds: 65,
    playCount: 3,
    createdAt: '2024-03-01T00:00:00.000Z',
    fileSizeBytes: 2 * 1024 * 1024,
  },
  {
    id: 'rec-old',
    ownerId: 'user-1',
    coverImageUrl: null,
    title: 'Eski Kayit',
    isPublic: false,
    shareSlug: null,
    durationSeconds: 600,
    playCount: 10,
    createdAt: '2024-01-01T00:00:00.000Z',
    fileSizeBytes: 1024,
  },
];

const mockApi = api as unknown as {
  getUserPodcasts: ReturnType<typeof vi.fn>;
  getRecordingDownloadUrl: ReturnType<typeof vi.fn>;
};

function renderLibrary() {
  return render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>,
  );
}

describe('Library page', () => {
  beforeEach(() => {
    authState.user = { id: 'user-1', username: 'ada' };
    authState.isAuthenticated = true;
    const store = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store.get(key) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      store.set(key, value);
    });
    mockApi.getUserPodcasts.mockResolvedValue({ podcasts });
    mockApi.getRecordingDownloadUrl.mockResolvedValue({ url: 'https://cdn.example/file.mp3' });
  });

  it('shows the user library and real storage instead of a fixed quota', async () => {
    renderLibrary();

    expect(await screen.findByText('Yeni Kayit')).toBeInTheDocument();
    expect(screen.getByText('Eski Kayit')).toBeInTheDocument();
    expect(screen.getByText('0 B / 2 MB')).toBeInTheDocument();
    expect(screen.getByText('2 podcasts')).toBeInTheDocument();
    expect(mockApi.getUserPodcasts).toHaveBeenCalledWith('user-1', 50);
    expect(screen.queryByText(/2\.4 GB/)).not.toBeInTheDocument();
  });

  it('filters favorites and downloads', async () => {
    renderLibrary();
    await screen.findByText('Yeni Kayit');

    fireEvent.click(screen.getByRole('button', { name: 'Yeni Kayit secenekleri' }));
    fireEvent.click(screen.getByRole('button', { name: 'Favorilere ekle' }));
    fireEvent.click(screen.getByRole('button', { name: 'FAVORITES' }));

    expect(screen.getByText('Yeni Kayit')).toBeInTheDocument();
    expect(screen.queryByText('Eski Kayit')).not.toBeInTheDocument();
    expect(screen.getByText('1 podcasts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yeni Kayit secenekleri' }));
    fireEvent.click(screen.getByRole('button', { name: 'Indir' }));

    await waitFor(() => {
      expect(screen.getByText('2 MB / 2 MB')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'DOWNLOADED' }));
    expect(screen.getByText('Yeni Kayit')).toBeInTheDocument();
    expect(screen.queryByText('Eski Kayit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CLEAR CACHE' }));
    expect(await screen.findByText('Henuz indirilen podcast yok')).toBeInTheDocument();
    expect(screen.getByText('0 B / 2 MB')).toBeInTheDocument();
  });

  it('sorts by duration when the sort control is used', async () => {
    renderLibrary();
    await screen.findByText('Yeni Kayit');

    fireEvent.click(screen.getByRole('button', { name: 'Siralama: NEWEST' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siralama: OLDEST' }));
    expect(screen.getByRole('button', { name: 'Siralama: LONGEST' })).toBeInTheDocument();

    const titles = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(titles).toEqual(['Eski Kayit', 'Yeni Kayit']);
  });

  it('does not open a listen page when the recording has no share link', async () => {
    renderLibrary();
    fireEvent.click(await screen.findByRole('button', { name: 'Eski Kayit' }));
    expect(navigate).not.toHaveBeenCalledWith('/listen/null');
    expect(navigate).not.toHaveBeenCalledWith('/listen/undefined');
  });

  it('sends signed-out visitors to login', () => {
    authState.user = null;
    authState.isAuthenticated = false;
    renderLibrary();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
