import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JoinRoom } from '../pages/JoinRoom';
import { useAuthStore } from '../lib/store';

function renderJoin(path = '/join') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/login" element={<p>Giris sayfasi</p>} />
        <Route path="/room/:slug" element={<p>Oda sayfasi</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('JoinRoom', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  });

  it('asks for a real code before leaving the form', () => {
    renderJoin();
    fireEvent.click(screen.getByRole('button', { name: 'KATIL' }));
    expect(screen.getByText('Oda kodu veya linki girin')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Oda kodu veya linki/i), { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'KATIL' }));
    expect(screen.getByText('Gecerli bir oda kodu veya linki girin')).toBeInTheDocument();
  });

  it('sends a guest to login and remembers the room', () => {
    renderJoin();
    fireEvent.change(screen.getByLabelText(/Oda kodu veya linki/i), {
      target: { value: 'https://livepodchat.com/room/abcd' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'KATIL' }));
    expect(screen.getByText('Giris sayfasi')).toBeInTheDocument();
    expect(sessionStorage.getItem('podchat:pendingRoom')).toBe('abcd');
  });

  it('opens the room when already signed in', () => {
    useAuthStore.setState({ user: null, token: 't', isAuthenticated: true });
    renderJoin();
    fireEvent.change(screen.getByLabelText(/Oda kodu veya linki/i), { target: { value: 'wxyz' } });
    fireEvent.click(screen.getByRole('button', { name: 'KATIL' }));
    expect(screen.getByText('Oda sayfasi')).toBeInTheDocument();
  });
});
