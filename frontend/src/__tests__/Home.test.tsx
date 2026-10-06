import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from '../pages/Home';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getPublicRooms: vi.fn(),
    joinRoom: vi.fn(),
  },
}));

const mockApi = api as unknown as {
  getPublicRooms: ReturnType<typeof vi.fn>;
};

const musicRoom = {
  id: 'room-1',
  slug: 'slug1',
  title: 'Friday Talks',
  status: 'live' as const,
  isPublic: true,
  hasPassword: false,
  host: { id: 'host-1', username: 'ada' },
  participantCount: 3,
  maxSpeakers: 10,
  topic: 'technology',
  description: 'Weekly notes',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe('Home discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getPublicRooms.mockResolvedValue({
      rooms: [musicRoom],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('loads every open room before a category is chosen', async () => {
    renderHome();

    expect(await screen.findByText('Friday Talks')).toBeInTheDocument();
    expect(screen.getAllByText('TECH').length).toBeGreaterThan(0);
    expect(screen.getByText('Weekly notes')).toBeInTheDocument();
    expect(mockApi.getPublicRooms).toHaveBeenCalledWith({ limit: 20 });
  });

  it('filters the list by the selected category', async () => {
    renderHome();
    await screen.findByText('Friday Talks');

    fireEvent.click(screen.getByRole('button', { name: 'SPORTS' }));

    await waitFor(() => {
      expect(mockApi.getPublicRooms).toHaveBeenCalledWith({ limit: 20, topic: 'sports' });
    });
    expect(screen.getByRole('button', { name: 'SPORTS' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an empty filter message when the category has no rooms', async () => {
    mockApi.getPublicRooms.mockImplementation(async (options?: { topic?: string }) => ({
      rooms: options?.topic ? [] : [musicRoom],
      total: options?.topic ? 0 : 1,
      limit: 20,
      offset: 0,
    }));

    renderHome();
    await screen.findByText('Friday Talks');

    fireEvent.click(screen.getByRole('button', { name: 'MUSIC' }));

    expect(await screen.findByText('Bu filtrede oda yok')).toBeInTheDocument();
    expect(screen.queryByText('Ilk Odayi Sen Olustur')).not.toBeInTheDocument();
  });

  it('searches after the user stops typing', async () => {
    renderHome();
    await screen.findByText('Friday Talks');

    fireEvent.change(screen.getByPlaceholderText('Search rooms or hosts...'), {
      target: { value: 'ada' },
    });

    await waitFor(() => {
      expect(mockApi.getPublicRooms).toHaveBeenCalledWith({ limit: 20, search: 'ada' });
    }, { timeout: 1500 });
  });
});
