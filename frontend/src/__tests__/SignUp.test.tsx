import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SignUp } from '../pages/SignUp';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    register: vi.fn(),
    setToken: vi.fn(),
  },
}));

vi.mock('../lib/store', () => ({
  useAuthStore: () => ({ setAuth: vi.fn() }),
}));

const mockApi = api as unknown as {
  register: ReturnType<typeof vi.fn>;
  setToken: ReturnType<typeof vi.fn>;
};

function renderSignUp() {
  return render(
    <MemoryRouter>
      <SignUp />
    </MemoryRouter>,
  );
}

describe('SignUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows that the password must be at least 6 characters', () => {
    renderSignUp();
    expect(screen.getByText('En az 6 karakter')).toBeInTheDocument();
  });

  it('links the terms and privacy policy', () => {
    renderSignUp();
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', expect.stringMatching(/\/legal\/terms$/));
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', expect.stringMatching(/\/legal\/privacy$/));
  });

  it('does not call the API when the password is too short', async () => {
    const user = userEvent.setup();
    renderSignUp();

    await user.type(screen.getByLabelText('Username'), '@ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), '12345');
    await user.type(screen.getByLabelText('Confirm Password'), '12345');
    await user.click(screen.getByRole('button', { name: 'Kullanim sartlarini kabul et' }));
    await user.click(screen.getByRole('button', { name: 'CREATE ACCOUNT' }));

    expect(screen.getByText('Sifre en az 6 karakter olmali')).toBeInTheDocument();
    expect(mockApi.register).not.toHaveBeenCalled();
  });

  it('registers with the @ stripped from the username', async () => {
    const user = userEvent.setup();
    mockApi.register.mockResolvedValue({
      token: 'token',
      user: { id: '1', username: 'ada', email: 'ada@example.com' },
    });
    renderSignUp();

    await user.type(screen.getByLabelText('Username'), '@ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret1');
    await user.type(screen.getByLabelText('Confirm Password'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Kullanim sartlarini kabul et' }));
    await user.click(screen.getByRole('button', { name: 'CREATE ACCOUNT' }));

    expect(mockApi.register).toHaveBeenCalledWith('ada', 'ada@example.com', 'secret1');
  });
});
