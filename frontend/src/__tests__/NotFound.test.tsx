import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFound } from '../pages/NotFound';

describe('NotFound', () => {
  it('names the missing path and links home and join', () => {
    render(
      <MemoryRouter initialEntries={['/yok']}>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Bu sayfa yok' })).toBeInTheDocument();
    expect(screen.getByText('/yok')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ANA SAYFA' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Oda koduyla katil' })).toHaveAttribute('href', '/join');
    expect(document.title).toBe('Sayfa bulunamadi · PodChat');
  });
});
