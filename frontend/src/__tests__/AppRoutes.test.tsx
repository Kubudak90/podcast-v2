import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from '../App';

describe('App routes', () => {
  afterEach(() => {
    cleanup();
    window.history.pushState({}, '', '/');
  });

  it('shows a not-found page for an unknown path', () => {
    window.history.pushState({}, '', '/yok');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Bu sayfa yok' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Odaya katil' })).toBeInTheDocument();
  });

  it('keeps the login page on /login', () => {
    window.history.pushState({}, '', '/login');
    render(<App />);
    expect(screen.getByRole('button', { name: 'LOGIN' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bu sayfa yok' })).not.toBeInTheDocument();
  });
});
