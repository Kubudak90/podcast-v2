import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TabBar } from '../components/Layout/TabBar';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar />
    </MemoryRouter>
  );
}

describe('TabBar', () => {
  it('marks only the open page as current', () => {
    renderAt('/');

    expect(screen.getByRole('navigation', { name: 'Ana menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Library' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Record' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current');
  });

  it.each([
    ['/library', 'Library'],
    ['/create-room', 'Record'],
    ['/profile', 'Profile'],
  ])('marks %s as the current page', (path, label) => {
    renderAt(path);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('gives each tab a 44px hit area', () => {
    renderAt('/');
    for (const label of ['Home', 'Library', 'Record', 'Profile']) {
      const tab = screen.getByRole('link', { name: label });
      expect(tab).toHaveClass('min-h-11', 'min-w-11');
    }
  });

  it.each(['/login', '/signup', '/listen/kayit', '/room/abc', '/room/abc/ended'])(
    'hides the tab bar on %s',
    (path) => {
      renderAt(path);
      expect(screen.queryByRole('navigation', { name: 'Ana menu' })).not.toBeInTheDocument();
    }
  );
});
