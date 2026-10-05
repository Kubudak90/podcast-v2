import type { UserPodcast } from '../types';

export type LibraryTab = 'all' | 'downloaded' | 'favorites';
export type LibrarySort = 'newest' | 'oldest' | 'longest' | 'plays' | 'largest';

export interface LibraryPrefs {
  favorites: string[];
  downloads: Record<string, number>;
  sort: LibrarySort;
}

export const LIBRARY_SORTS: { key: LibrarySort; label: string }[] = [
  { key: 'newest', label: 'NEWEST' },
  { key: 'oldest', label: 'OLDEST' },
  { key: 'longest', label: 'LONGEST' },
  { key: 'plays', label: 'PLAYS' },
  { key: 'largest', label: 'SIZE' },
];

const SORT_KEYS = new Set<LibrarySort>(LIBRARY_SORTS.map((item) => item.key));

export function emptyLibraryPrefs(): LibraryPrefs {
  return { favorites: [], downloads: {}, sort: 'newest' };
}

export function libraryStorageKey(userId: string): string {
  return `podchat:library:${userId}`;
}

export function loadLibraryPrefs(
  userId: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): LibraryPrefs {
  try {
    const raw = storage.getItem(libraryStorageKey(userId));
    if (!raw) return emptyLibraryPrefs();
    const parsed = JSON.parse(raw) as Partial<LibraryPrefs>;
    const favorites = Array.isArray(parsed.favorites)
      ? parsed.favorites.filter((id): id is string => typeof id === 'string')
      : [];
    const downloads: Record<string, number> = {};
    if (parsed.downloads && typeof parsed.downloads === 'object') {
      for (const [id, bytes] of Object.entries(parsed.downloads)) {
        if (typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0) {
          downloads[id] = bytes;
        }
      }
    }
    const sort = parsed.sort && SORT_KEYS.has(parsed.sort) ? parsed.sort : 'newest';
    return { favorites, downloads, sort };
  } catch {
    return emptyLibraryPrefs();
  }
}

export function saveLibraryPrefs(
  userId: string,
  prefs: LibraryPrefs,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(libraryStorageKey(userId), JSON.stringify(prefs));
}

export function nextLibrarySort(sort: LibrarySort): LibrarySort {
  const index = LIBRARY_SORTS.findIndex((item) => item.key === sort);
  return LIBRARY_SORTS[(index + 1) % LIBRARY_SORTS.length].key;
}

export function sortLabel(sort: LibrarySort): string {
  return LIBRARY_SORTS.find((item) => item.key === sort)?.label ?? 'NEWEST';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  const rounded = value.toFixed(digits);
  const label = rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
  return `${label} ${units[unit]}`;
}

export function podcastBytes(podcast: UserPodcast): number {
  const size = podcast.fileSizeBytes ?? 0;
  return Number.isFinite(size) && size > 0 ? size : 0;
}

export function libraryByteTotals(podcasts: UserPodcast[], downloads: Record<string, number>) {
  const ids = new Set(podcasts.map((podcast) => podcast.id));
  const totalBytes = podcasts.reduce((sum, podcast) => sum + podcastBytes(podcast), 0);
  const downloadedBytes = Object.entries(downloads).reduce((sum, [id, bytes]) => {
    if (!ids.has(id) || !Number.isFinite(bytes) || bytes <= 0) return sum;
    return sum + bytes;
  }, 0);
  const percent = totalBytes === 0 ? 0 : Math.min(100, (downloadedBytes / totalBytes) * 100);
  return { totalBytes, downloadedBytes, percent };
}

export function filterPodcasts(
  podcasts: UserPodcast[],
  tab: LibraryTab,
  prefs: Pick<LibraryPrefs, 'favorites' | 'downloads'>,
): UserPodcast[] {
  if (tab === 'favorites') {
    const favorites = new Set(prefs.favorites);
    return podcasts.filter((podcast) => favorites.has(podcast.id));
  }
  if (tab === 'downloaded') {
    return podcasts.filter((podcast) => Object.prototype.hasOwnProperty.call(prefs.downloads, podcast.id));
  }
  return podcasts;
}

export function sortPodcasts(podcasts: UserPodcast[], sort: LibrarySort): UserPodcast[] {
  const copy = [...podcasts];
  copy.sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      case 'longest':
        return (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0);
      case 'plays':
        return b.playCount - a.playCount || Date.parse(b.createdAt) - Date.parse(a.createdAt);
      case 'largest':
        return podcastBytes(b) - podcastBytes(a);
      default:
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }
  });
  return copy;
}

export function toggleFavorite(prefs: LibraryPrefs, podcastId: string): LibraryPrefs {
  const favorites = prefs.favorites.includes(podcastId)
    ? prefs.favorites.filter((id) => id !== podcastId)
    : [...prefs.favorites, podcastId];
  return { ...prefs, favorites };
}

export function markDownloaded(prefs: LibraryPrefs, podcastId: string, bytes: number): LibraryPrefs {
  return {
    ...prefs,
    downloads: { ...prefs.downloads, [podcastId]: Number.isFinite(bytes) && bytes > 0 ? bytes : 0 },
  };
}

export function clearDownloads(prefs: LibraryPrefs): LibraryPrefs {
  return { ...prefs, downloads: {} };
}
