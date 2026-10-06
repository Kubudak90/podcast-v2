import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionBanner } from '../components/ConnectionBanner';

describe('ConnectionBanner', () => {
  it('stays hidden while the socket is connected', () => {
    render(<ConnectionBanner status="connected" onRetry={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a retry message while reconnecting', () => {
    render(<ConnectionBanner status="reconnecting" onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Baglanti koptu. Yeniden deneniyor...');
    expect(screen.queryByRole('button', { name: 'Tekrar dene' })).not.toBeInTheDocument();
  });

  it('asks the user to retry after the connection gives up', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ConnectionBanner status="disconnected" onRetry={onRetry} />);

    expect(screen.getByRole('status')).toHaveTextContent('Canli baglanti kurulamadi');
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
