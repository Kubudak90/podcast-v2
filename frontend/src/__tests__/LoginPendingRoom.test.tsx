import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Login } from '../pages/Login';
import { api } from '../lib/api';
import { rememberPendingRoom } from '../lib/roomLink';
import { useAuthStore } from '../lib/store';

vi.mock('../lib/api', () => ({
  api: {
    login: vi.fn(),
    setToken: vi.fn(),
  },
}));

const user = {
  id: 'u1',
  username: 'ada',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Ana sayfa</p>} />
        <Route path="/room/:slug" element={<p>Oda sayfasi</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Login pending room', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    vi.mocked(api.login).mockResolvedValue({ user, token: 'tok' });
  });

  it('opens the room the guest was trying to join', async () => {
    rememberPendingRoom('abcd');
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
    expect(await screen.findByText('Oda sayfasi')).toBeInTheDocument();
    expect(sessionStorage.getItem('podchat:pendingRoom')).toBeNull();
  });

  it('stays on home when nothing is waiting', async () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
    expect(await screen.findByText('Ana sayfa')).toBeInTheDocument();
  });

  it('keeps the room when login fails', async () => {
    rememberPendingRoom('abcd');
    vi.mocked(api.login).mockRejectedValue(new Error('Giris yapilamadi'));
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
    expect(await screen.findByText('Giris yapilamadi')).toBeInTheDocument();
    await waitFor(() => {
      expect(sessionStorage.getItem('podchat:pendingRoom')).toBe('abcd');
    });
  });
});
