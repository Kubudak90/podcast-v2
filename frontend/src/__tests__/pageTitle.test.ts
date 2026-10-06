import { describe, expect, it } from 'vitest';
import { formatPageTitle, pageTitleForPath } from '../lib/pageTitle';

describe('pageTitleForPath', () => {
  it('names the main screens', () => {
    expect(pageTitleForPath('/')).toBe('Ana sayfa · PodChat');
    expect(pageTitleForPath('/login')).toBe('Giris · PodChat');
    expect(pageTitleForPath('/signup')).toBe('Kayit · PodChat');
    expect(pageTitleForPath('/create-room')).toBe('Oda olustur · PodChat');
    expect(pageTitleForPath('/library')).toBe('Kutuphane · PodChat');
    expect(pageTitleForPath('/profile')).toBe('Profil · PodChat');
    expect(pageTitleForPath('/listen/abc')).toBe('Dinle · PodChat');
    expect(pageTitleForPath('/join')).toBe('Odaya katil · PodChat');
    expect(pageTitleForPath('/forgot-password')).toBe('Sifremi unuttum · PodChat');
    expect(pageTitleForPath('/reset-password')).toBe('Sifre sifirla · PodChat');
    expect(pageTitleForPath('/u/user-1')).toBe('Profil · PodChat');
  });

  it('ignores a trailing slash', () => {
    expect(pageTitleForPath('/library/')).toBe('Kutuphane · PodChat');
  });

  it('uses a generic room title until the room name is known', () => {
    expect(pageTitleForPath('/room/abc')).toBe('Oda · PodChat');
    expect(pageTitleForPath('/room/abc/ended')).toBe('Yayin bitti · PodChat');
  });

  it('uses the open room name only when the slug matches', () => {
    expect(pageTitleForPath('/room/abc', { roomSlug: 'abc', roomTitle: 'Friday Talks' })).toBe(
      'Friday Talks · PodChat',
    );
    expect(pageTitleForPath('/room/abc/ended', { roomSlug: 'abc', roomTitle: 'Friday Talks' })).toBe(
      'Friday Talks · PodChat',
    );
    expect(pageTitleForPath('/room/abc', { roomSlug: 'other', roomTitle: 'Friday Talks' })).toBe(
      'Oda · PodChat',
    );
  });

  it('decodes the room slug before comparing', () => {
    expect(pageTitleForPath('/room/caf%C3%A9', { roomSlug: 'café', roomTitle: 'Kahve' })).toBe(
      'Kahve · PodChat',
    );
  });

  it('drops a blank room name', () => {
    expect(pageTitleForPath('/room/abc', { roomSlug: 'abc', roomTitle: '   ' })).toBe('Oda · PodChat');
  });

  it('leaves unknown paths untitled', () => {
    expect(pageTitleForPath('/yok')).toBeNull();
    expect(pageTitleForPath('/room')).toBeNull();
    expect(pageTitleForPath('/listen')).toBeNull();
  });

  it('shortens a very long label', () => {
    const title = formatPageTitle('A'.repeat(120));
    expect(title.endsWith(' · PodChat')).toBe(true);
    expect(title.length).toBeLessThan(100);
    expect(title.includes('…')).toBe(true);
  });
});
