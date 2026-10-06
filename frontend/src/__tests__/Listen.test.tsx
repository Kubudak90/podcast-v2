import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Listen } from '../pages/Listen';
import { api } from '../lib/api';
import type { Mock } from 'vitest';

vi.mock('../lib/api', () => ({
  api: {
    getPublicRecording: vi.fn(),
    getPublicRecordingDownload: vi.fn(),
  },
}));

const recording = {
  id: 'rec-1',
  title: 'Night Drive',
  description: 'A late talk',
  shareSlug: 'ep-1',
  durationSeconds: 600,
  playCount: 12,
  createdAt: '2026-01-02T00:00:00.000Z',
  room: { id: 'room-1', slug: 'room', title: 'Room' },
  host: { id: 'host-1', username: 'ada' },
};

const store = new Map<string, string>();
const getItem = localStorage.getItem as unknown as Mock<(key: string) => string | null>;
const setItem = localStorage.setItem as unknown as Mock<(key: string, value: string) => void>;
const removeItem = localStorage.removeItem as unknown as Mock<(key: string) => void>;

function renderListen(path = '/listen/ep-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/listen/:shareSlug" element={<Listen />} />
      </Routes>
    </MemoryRouter>
  );
}

function audioEl(): HTMLAudioElement {
  const audio = document.querySelector('audio');
  if (!audio) throw new Error('audio element missing');
  return audio;
}

describe('Listen page', () => {
  beforeEach(() => {
    store.clear();
    getItem.mockImplementation((key: string) => store.get(key) ?? null);
    setItem.mockImplementation((key: string, value: string) => {
      store.set(key, value);
    });
    removeItem.mockImplementation((key: string) => {
      store.delete(key);
    });

    vi.mocked(api.getPublicRecording).mockResolvedValue(recording);
    vi.mocked(api.getPublicRecordingDownload).mockResolvedValue({ url: 'https://example.com/ep.mp3' });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
  });

  it('resumes from the saved position', async () => {
    store.set('podchat:listen:ep-1', '125');
    renderListen();

    await waitFor(() => expect(document.querySelector('audio')).toBeTruthy());
    const audio = audioEl();
    Object.defineProperty(audio, 'duration', { configurable: true, value: 600 });
    fireEvent.loadedMetadata(audio);

    expect(audio.currentTime).toBe(125);
    expect(screen.getByText(/Resumed at 2:05/)).toBeInTheDocument();
  });

  it('starts over and forgets the saved position', async () => {
    store.set('podchat:listen:ep-1', '125');
    renderListen();
    await waitFor(() => expect(document.querySelector('audio')).toBeTruthy());
    const audio = audioEl();
    Object.defineProperty(audio, 'duration', { configurable: true, value: 600 });
    fireEvent.loadedMetadata(audio);

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));

    expect(audio.currentTime).toBe(0);
    expect(store.has('podchat:listen:ep-1')).toBe(false);
    expect(screen.queryByText(/Resumed at/)).not.toBeInTheDocument();
  });

  it('keeps the play button idle when playback is rejected', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'));
    renderListen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't play this recording. Try again.");
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('shows pause after playback starts', async () => {
    renderListen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('changes and remembers playback speed', async () => {
    renderListen();
    await waitFor(() => expect(document.querySelector('audio')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: '1.5×' }));

    expect(audioEl().playbackRate).toBe(1.5);
    expect(store.get('podchat:playbackRate')).toBe('1.5');
    expect(screen.getByRole('button', { name: '1.5×' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves progress and clears it when the episode ends', async () => {
    renderListen();
    await waitFor(() => expect(document.querySelector('audio')).toBeTruthy());
    const audio = audioEl();
    Object.defineProperty(audio, 'duration', { configurable: true, value: 600 });

    audio.currentTime = 42;
    fireEvent.timeUpdate(audio);
    expect(store.get('podchat:listen:ep-1')).toBe('42');

    fireEvent.ended(audio);
    expect(store.has('podchat:listen:ep-1')).toBe(false);
  });

  it('keeps a bookmark when playback is still at the start', async () => {
    store.set('podchat:listen:ep-1', '125');
    renderListen();
    await waitFor(() => expect(document.querySelector('audio')).toBeTruthy());
    const audio = audioEl();
    Object.defineProperty(audio, 'duration', { configurable: true, value: 600 });
    audio.currentTime = 0;
    fireEvent.timeUpdate(audio);
    fireEvent(window, new Event('pagehide'));
    expect(store.get('podchat:listen:ep-1')).toBe('125');
  });

  it('drops a position that is already at the end', async () => {
    renderListen();
    await waitFor(() => expect(document.querySelector('audio')).toBeTruthy());
    const audio = audioEl();
    Object.defineProperty(audio, 'duration', { configurable: true, value: 600 });
    audio.currentTime = 598;
    fireEvent.timeUpdate(audio);
    expect(store.has('podchat:listen:ep-1')).toBe(false);
  });
});
