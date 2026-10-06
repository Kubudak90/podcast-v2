import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Login } from '../pages/Login';
import { ForgotPassword } from '../pages/ForgotPassword';
import { ResetPassword } from '../pages/ResetPassword';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    setToken: vi.fn(),
    login: vi.fn(),
  },
}));

const mockApi = api as unknown as {
  forgotPassword: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
  setToken: ReturnType<typeof vi.fn>;
};

describe('Password reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links Forgot password to the reset request page', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
  });

  it('asks for an email before requesting a link', () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'SEND RESET LINK' }));
    expect(screen.getByText('Email gerekli')).toBeInTheDocument();
    expect(mockApi.forgotPassword).not.toHaveBeenCalled();
  });

  it('shows the server notice when email delivery is unavailable', async () => {
    mockApi.forgotPassword.mockResolvedValue({
      message: 'Password reset email is not configured',
      emailDelivery: 'unavailable',
    });

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'SEND RESET LINK' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Password reset email is not configured');
    expect(mockApi.forgotPassword).toHaveBeenCalledWith('user@example.com');
  });

  it('shows a local reset link when the server returns one', async () => {
    mockApi.forgotPassword.mockResolvedValue({
      message: 'If an account exists for that email, a reset link is on its way. It expires in 30 minutes.',
      emailDelivery: 'dev',
      devResetUrl: 'http://localhost:5173/reset-password?token=abc',
    });

    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'SEND RESET LINK' }));

    const link = await screen.findByRole('link', { name: 'Open reset link' });
    expect(link).toHaveAttribute('href', 'http://localhost:5173/reset-password?token=abc');
  });

  it('explains a missing reset token', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Reset link missing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('rejects a short password and a mismatch', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=token-value-1234567890']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'UPDATE PASSWORD' }));
    expect(screen.getByText('Sifre en az 6 karakter olmali')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'UPDATE PASSWORD' }));
    expect(screen.getByText('Sifreler eslesmiyor')).toBeInTheDocument();
    expect(mockApi.resetPassword).not.toHaveBeenCalled();
  });

  it('signs in after a successful reset', async () => {
    mockApi.resetPassword.mockResolvedValue({
      user: {
        id: 'user-1',
        username: 'ada',
        email: 'ada@example.com',
        avatarUrl: null,
        bio: null,
        createdAt: '2026-10-06T00:00:00.000Z',
      },
      token: 'jwt-token',
    });

    render(
      <MemoryRouter initialEntries={['/reset-password?token=token-value-1234567890']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<div>home screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'longenough' } });
    fireEvent.click(screen.getByRole('button', { name: 'UPDATE PASSWORD' }));

    expect(await screen.findByText('home screen')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockApi.resetPassword).toHaveBeenCalledWith('token-value-1234567890', 'longenough');
      expect(mockApi.setToken).toHaveBeenCalledWith('jwt-token');
    });
  });
});
