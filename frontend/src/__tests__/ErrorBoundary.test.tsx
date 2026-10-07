import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

function ImmediateBomb(): never {
  throw new Error('postgres://secret-db/podchat');
}

function BoomOnce() {
  const [count, setCount] = useState(0);
  if (count > 0) {
    throw new Error('postgres://secret-db/podchat');
  }
  return (
    <button type="button" onClick={() => setCount(1)}>
      Patlat
    </button>
  );
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Saglam icerik</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('Saglam icerik')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('focuses the heading when the first render throws', () => {
    render(
      <ErrorBoundary>
        <ImmediateBomb />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: 'Bir hata olustu' })).toHaveFocus();
    expect(screen.queryByText(/secret-db/)).not.toBeInTheDocument();
  });

  it('shows a friendly message and hides the technical error', () => {
    render(
      <ErrorBoundary>
        <BoomOnce />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Patlat' }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bir hata olustu' })).toHaveFocus();
    expect(
      screen.getByText('Beklenmeyen bir hata meydana geldi. Lutfen tekrar deneyin.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/secret-db/)).not.toBeInTheDocument();
    expect(screen.queryByText('Hata detaylari')).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it('gives the actions a 44px target and a keyboard focus ring', () => {
    render(
      <ErrorBoundary>
        <BoomOnce />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Patlat' }));

    for (const name of ['Tekrar Dene', 'Ana Sayfa']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass(
        'min-h-11',
        'min-w-11',
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-white'
      );
    }

    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('remounts children on retry so a bad update can recover', () => {
    render(
      <ErrorBoundary>
        <BoomOnce />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Patlat' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patlat' })).toBeInTheDocument();
    expect(screen.queryByText(/secret-db/)).not.toBeInTheDocument();
  });

  it('sends the reader home', () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, assign },
    });

    render(
      <ErrorBoundary>
        <BoomOnce />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Patlat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ana Sayfa' }));

    expect(assign).toHaveBeenCalledWith('/');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: original,
    });
  });

  it('renders a custom fallback without the technical error', () => {
    render(
      <ErrorBoundary fallback={<p>Ozel ekran</p>}>
        <BoomOnce />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Patlat' }));

    expect(screen.getByText('Ozel ekran')).toBeInTheDocument();
    expect(screen.queryByText(/secret-db/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bir hata olustu' })).not.toBeInTheDocument();
  });
});
