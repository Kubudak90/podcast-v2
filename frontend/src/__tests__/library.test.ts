import { describe, expect, it } from 'vitest';
import {
  clearDownloads,
  filterPodcasts,
  formatBytes,
  libraryByteTotals,
  loadLibraryPrefs,
  markDownloaded,
  nextLibrarySort,
  saveLibraryPrefs,
  sortPodcasts,
  toggleFavorite,
} from '../lib/library';
import type { UserPodcast } from '../types';

const podcasts: UserPodcast[] = [
  {
    id: 'new',
    ownerId: 'me',
    coverImageUrl: null,
    title: 'New',
    isPublic: true,
    shareSlug: 'new',
    durationSeconds: 30,
    playCount: 1,
    createdAt: '2024-02-02T00:00:00.000Z',
    fileSizeBytes: 2048,
  },
  {
    id: 'old',
    ownerId: 'me',
    coverImageUrl: null,
    title: 'Old',
    isPublic: false,
    shareSlug: null,
    durationSeconds: 120,
    playCount: 9,
    createdAt: '2024-01-01T00:00:00.000Z',
    fileSizeBytes: 1024,
  },
];

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data,
  };
}

describe('library prefs', () => {
  it('loads empty prefs when nothing is stored', () => {
    expect(loadLibraryPrefs('me', memoryStorage())).toEqual({ favorites: [], downloads: {}, sort: 'newest' });
  });

  it('round-trips favorites, downloads, and sort', () => {
    const storage = memoryStorage();
    saveLibraryPrefs('me', { favorites: ['a'], downloads: { a: 10 }, sort: 'plays' }, storage);
    expect(loadLibraryPrefs('me', storage)).toEqual({ favorites: ['a'], downloads: { a: 10 }, sort: 'plays' });
  });

  it('drops corrupt storage', () => {
    const storage = memoryStorage({ 'podchat:library:me': '{' });
    expect(loadLibraryPrefs('me', storage).favorites).toEqual([]);
  });
});

describe('library views', () => {
  it('formats byte totals without a fake quota', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    const totals = libraryByteTotals(podcasts, { new: 2048, missing: 999 });
    expect(totals).toEqual({ totalBytes: 3072, downloadedBytes: 2048, percent: (2048 / 3072) * 100 });
  });

  it('filters favorites and downloads', () => {
    const prefs = { favorites: ['old'], downloads: { new: 2048 } };
    expect(filterPodcasts(podcasts, 'favorites', prefs).map((item) => item.id)).toEqual(['old']);
    expect(filterPodcasts(podcasts, 'downloaded', prefs).map((item) => item.id)).toEqual(['new']);
    expect(filterPodcasts(podcasts, 'all', prefs)).toHaveLength(2);
  });

  it('sorts by duration and play count', () => {
    expect(sortPodcasts(podcasts, 'longest').map((item) => item.id)).toEqual(['old', 'new']);
    expect(sortPodcasts(podcasts, 'plays').map((item) => item.id)).toEqual(['old', 'new']);
    expect(sortPodcasts(podcasts, 'oldest').map((item) => item.id)).toEqual(['old', 'new']);
    expect(nextLibrarySort('largest')).toBe('newest');
  });

  it('toggles favorites and clears downloads', () => {
    const favorited = toggleFavorite({ favorites: [], downloads: {}, sort: 'newest' }, 'old');
    expect(favorited.favorites).toEqual(['old']);
    const downloaded = markDownloaded(favorited, 'old', 1024);
    expect(clearDownloads(downloaded)).toEqual({ favorites: ['old'], downloads: {}, sort: 'newest' });
    expect(toggleFavorite(favorited, 'old').favorites).toEqual([]);
  });
});
