import { useEffect } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { RouteTitle } from '../components/RouteTitle';
import { DEFAULT_DOCUMENT_TITLE } from '../lib/pageTitle';
import { useRoomStore } from '../lib/store';
import type { Room } from '../types';

function LaterTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === '/yok') document.title = 'Sayfa bulunamadi · PodChat';
  }, [pathname]);
  return null;
}

function Go({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      git
    </button>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteTitle />
      <LaterTitle />
      <Go to="/library" />
    </MemoryRouter>,
  );
}

const room = {
  id: '1',
  slug: 'abc',
  title: 'Friday Talks',
  hostId: 'h',
  status: 'live',
  maxSpeakers: 10,
  isPublic: true,
  hasPassword: false,
  createdAt: '2026-10-06T00:00:00.000Z',
} as Room;

describe('RouteTitle', () => {
  beforeEach(() => {
    document.title = DEFAULT_DOCUMENT_TITLE;
    useRoomStore.setState({ currentRoom: null });
  });

  it('sets the home, library, and profile tab titles', () => {
    const { unmount } = renderAt('/');
    expect(document.title).toBe('Ana sayfa · PodChat');
    unmount();

    const library = renderAt('/library');
    expect(document.title).toBe('Kutuphane · PodChat');
    library.unmount();

    renderAt('/profile');
    expect(document.title).toBe('Profil · PodChat');
  });

  it('switches title when the route changes', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RouteTitle />
        <Go to="/create-room" />
      </MemoryRouter>,
    );
    expect(document.title).toBe('Ana sayfa · PodChat');
    fireEvent.click(screen.getByRole('button', { name: 'git' }));
    expect(document.title).toBe('Oda olustur · PodChat');
  });

  it('uses the room name once that room is open', () => {
    useRoomStore.setState({ currentRoom: room });
    renderAt('/room/abc');
    expect(document.title).toBe('Friday Talks · PodChat');
  });

  it('updates the room title when the open room arrives', () => {
    renderAt('/room/abc');
    expect(document.title).toBe('Oda · PodChat');
    act(() => {
      useRoomStore.setState({ currentRoom: room });
    });
    expect(document.title).toBe('Friday Talks · PodChat');
  });

  it('does not replace a title chosen by an unknown page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RouteTitle />
        <LaterTitle />
        <Go to="/yok" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'git' }));
    expect(document.title).toBe('Sayfa bulunamadi · PodChat');
  });
});
