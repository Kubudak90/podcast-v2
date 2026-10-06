import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer, toast, useToastStore } from '../components/Toast';

function liveRegion(kind: 'polite' | 'assertive') {
  const region = document.querySelector(`[aria-live="${kind}"]`);
  if (!region) throw new Error(`missing ${kind} live region`);
  return region;
}

describe('Toast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('keeps live regions mounted before any toast', () => {
    render(<ToastContainer />);
    expect(liveRegion('polite')).toHaveTextContent('');
    expect(liveRegion('assertive')).toHaveTextContent('');
    expect(liveRegion('polite')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('button', { name: 'Kapat' })).not.toBeInTheDocument();
  });

  it('announces a success in the polite region', async () => {
    render(<ToastContainer />);
    act(() => {
      toast.success('Profil guncellendi');
    });

    expect(screen.getByText('Profil guncellendi')).toBeInTheDocument();
    await waitFor(() => {
      expect(liveRegion('polite')).toHaveTextContent('Profil guncellendi');
    });
    expect(liveRegion('assertive')).toHaveTextContent('');
  });

  it('announces an error in the assertive region', async () => {
    render(<ToastContainer />);
    act(() => {
      toast.error('Yayin baslatilamadi');
    });

    await waitFor(() => {
      expect(liveRegion('assertive')).toHaveTextContent('Yayin baslatilamadi');
    });
    expect(liveRegion('polite')).toHaveTextContent('');
  });

  it('names the close control and removes the toast', async () => {
    const user = userEvent.setup();
    render(<ToastContainer />);
    act(() => {
      toast.warning('Baglanti zayif');
    });

    const close = screen.getByRole('button', { name: 'Kapat' });
    expect(close).toHaveClass('min-h-11', 'min-w-11');
    expect(close).toHaveAttribute('aria-describedby');
    const described = document.getElementById(close.getAttribute('aria-describedby') || '');
    expect(described).toHaveTextContent('Baglanti zayif');

    await user.click(close);
    expect(screen.queryByRole('button', { name: 'Kapat' })).not.toBeInTheDocument();
    expect(liveRegion('assertive')).toHaveTextContent('Baglanti zayif');
  });

  it('dismisses itself after the given duration', async () => {
    render(<ToastContainer />);
    act(() => {
      toast.info('Kisa bildirim', 80);
    });

    expect(screen.getByRole('button', { name: 'Kapat' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Kapat' })).not.toBeInTheDocument();
    });
  });

  it('hides decorative icons from the accessibility tree', () => {
    render(<ToastContainer />);
    act(() => {
      toast.error('Hata');
    });

    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
