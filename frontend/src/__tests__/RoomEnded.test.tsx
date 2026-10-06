import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoomEnded } from '../pages/RoomEnded';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { useToastStore } from '../components/Toast';
import type { Recording, Room } from '../types';

vi.mock('../lib/api', () => ({
  api: {
    getRoom: vi.fn(),
    getRoomRecordings: vi.fn(),
    getRecordingDownloadUrl: vi.fn(),
    updateRecording: vi.fn(),
  },
}));

const mockApi = api as unknown as {
  getRoom: ReturnType<typeof vi.fn>;
  getRoomRecordings: ReturnType<typeof vi.fn>;
  getRecordingDownloadUrl: ReturnType<typeof vi.fn>;
  updateRecording: ReturnType<typeof vi.fn>;
};

const room: Room = {
  id: 'room-1',
  slug: 'abc',
  title: 'Friday Talk',
  hostId: 'host-1',
  status: 'ended',
  maxSpeakers: 10,
  isPublic: true,
  hasPassword: false,
  createdAt: '2024-01-01T00:00:00Z',
};

const recording: Recording = {
  id: 'rec-1',
  roomId: 'room-1',
  ownerId: 'host-1',
  fileUrl: 'local://rec.mp4',
  title: 'Friday Talk',
  description: '',
  isPublic: false,
  durationSeconds: 125,
  fileSizeBytes: 2_500_000,
  format: 'mp4',
  createdAt: '2024-01-15T10:00:00Z',
};

function renderEnded() {
  return render(
    <MemoryRouter initialEntries={['/room/abc/ended']}>
      <Routes>
        <Route path="/room/:slug/ended" element={<RoomEnded />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoomEnded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    useAuthStore.setState({
      user: { id: 'host-1', username: 'ada', createdAt: '2024-01-01T00:00:00Z' },
      token: 'token',
      isAuthenticated: true,
    });
    mockApi.getRoom.mockResolvedValue(room);
    mockApi.getRoomRecordings.mockResolvedValue([recording]);
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('lets the owner publish the recording and then open the listen link', async () => {
    mockApi.updateRecording.mockResolvedValue({
      ...recording,
      isPublic: true,
      shareSlug: 'slug-1',
    });

    renderEnded();

    fireEvent.click(await screen.findByRole('button', { name: 'Paylas' }));
    expect(screen.getByText('Share Recording')).toBeInTheDocument();

    const toggle = screen.getByText('Make Public').closest('div')?.parentElement?.querySelector('button');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle!);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockApi.updateRecording).toHaveBeenCalledWith('rec-1', {
        title: 'Friday Talk',
        description: undefined,
        isPublic: true,
      });
    });

    const listenLink = await screen.findByRole('link', { name: 'Dinle' });
    expect(listenLink).toHaveAttribute('href', '/listen/slug-1');
    expect(screen.getByText(/Herkese acik/)).toBeInTheDocument();
  });

  it('hides sharing from someone who does not own the recording', async () => {
    useAuthStore.setState({
      user: { id: 'listener-1', username: 'lee', createdAt: '2024-01-01T00:00:00Z' },
      token: 'token',
      isAuthenticated: true,
    });

    renderEnded();

    expect(await screen.findByRole('button', { name: 'Indir' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Paylas' })).not.toBeInTheDocument();
  });

  it('shows the server message when the file is not ready to download', async () => {
    mockApi.getRecordingDownloadUrl.mockRejectedValue(new Error('Recording file not available yet'));

    renderEnded();
    fireEvent.click(await screen.findByRole('button', { name: 'Indir' }));

    await waitFor(() => {
      expect(useToastStore.getState().toasts.some((item) => item.message === 'Recording file not available yet')).toBe(true);
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it('shows a load error instead of an empty recording list', async () => {
    mockApi.getRoom.mockRejectedValue(new Error('offline'));

    renderEnded();

    expect(await screen.findByText('Yayin bilgisi yuklenemedi')).toBeInTheDocument();
    expect(screen.queryByText('Bu yayin icin kayit bulunamadi.')).not.toBeInTheDocument();
  });
});
