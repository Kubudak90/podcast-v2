import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  clearDownloads,
  emptyLibraryPrefs,
  filterPodcasts,
  formatBytes,
  libraryByteTotals,
  loadLibraryPrefs,
  markDownloaded,
  nextLibrarySort,
  podcastBytes,
  saveLibraryPrefs,
  sortLabel,
  sortPodcasts,
  toggleFavorite,
  type LibraryPrefs,
  type LibraryTab,
} from '../lib/library';
import { useAuthStore } from '../lib/store';
import { toast } from '../components/Toast';
import type { UserPodcast } from '../types';

const TABS: { key: LibraryTab; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'downloaded', label: 'DOWNLOADED' },
  { key: 'favorites', label: 'FAVORITES' },
];

const EMPTY_COPY: Record<LibraryTab, string> = {
  all: 'Henuz podcast yok',
  downloaded: 'Henuz indirilen podcast yok',
  favorites: 'Henuz favori podcast yok',
};

function formatDuration(seconds: number | null) {
  const safe = seconds && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function Library() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const userId = user?.id ?? null;
  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [podcasts, setPodcasts] = useState<UserPodcast[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(userId);
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => (userId ? loadLibraryPrefs(userId) : emptyLibraryPrefs()));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (userId !== loadedFor) {
    setLoadedFor(userId);
    setPrefs(userId ? loadLibraryPrefs(userId) : emptyLibraryPrefs());
  }

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      navigate('/login');
      return;
    }

    let cancelled = false;
    api.getUserPodcasts(userId, 50)
      .then((response) => {
        if (!cancelled) setPodcasts(response.podcasts);
      })
      .catch(() => {
        if (!cancelled) setError('Podcastler yuklenemedi');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate, userId]);

  const updatePrefs = (next: LibraryPrefs | ((current: LibraryPrefs) => LibraryPrefs)) => {
    setPrefs((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      if (userId) saveLibraryPrefs(userId, resolved);
      return resolved;
    });
  };

  const visible = sortPodcasts(filterPodcasts(podcasts, activeTab, prefs), prefs.sort);
  const totals = libraryByteTotals(podcasts, prefs.downloads);
  const downloadedCount = podcasts.filter((podcast) => Object.prototype.hasOwnProperty.call(prefs.downloads, podcast.id)).length;

  const openPodcast = (podcast: UserPodcast) => {
    if (!podcast.shareSlug) {
      toast.info('Bu kaydin paylasim linki yok');
      return;
    }
    navigate(`/listen/${podcast.shareSlug}`);
  };

  const handleDownload = async (podcast: UserPodcast) => {
    setOpenMenuId(null);
    try {
      const { url } = await api.getRecordingDownloadUrl(podcast.id);
      updatePrefs((current) => markDownloaded(current, podcast.id, podcastBytes(podcast)));
      const link = document.createElement('a');
      link.href = url;
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Indirme basladi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Indirme basarisiz');
    }
  };

  const handleClearCache = () => {
    if (downloadedCount === 0) {
      toast.info('Indirme listesi zaten bos');
      return;
    }
    updatePrefs(clearDownloads(prefs));
    toast.success('Indirme listesi temizlendi');
  };

  const cycleSort = () => {
    updatePrefs({ ...prefs, sort: nextLibrarySort(prefs.sort) });
  };

  return (
    <div className="min-h-screen bg-pod-bg">
      <div className="px-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight">LIBRARY</h1>
          <button
            type="button"
            onClick={cycleSort}
            aria-label={`Sirala: ${sortLabel(prefs.sort)}`}
            className="w-11 h-11 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary">STORAGE</p>
            <p className="text-pod-red text-xs font-mono font-bold" title="Indirilen / kutuphane">
              {formatBytes(totals.downloadedBytes)} / {formatBytes(totals.totalBytes)}
            </p>
          </div>
          <div className="w-full h-2 rounded-full border border-pod-border overflow-hidden">
            <div
              className="h-full bg-pod-red rounded-full transition-all"
              style={{ width: `${totals.percent}%` }}
            />
          </div>
        </section>

        <div className="flex border border-pod-border rounded-lg overflow-hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setOpenMenuId(null); }}
              className={`flex-1 min-h-11 py-3 text-xs font-semibold tracking-wider text-center transition-colors ${
                activeTab === tab.key ? 'bg-pod-red text-white' : 'text-white hover:bg-pod-elevated'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary">
              {activeTab === 'favorites' ? 'FAVORITES' : activeTab === 'downloaded' ? 'DOWNLOADS' : 'PODCASTS'}
            </p>
            <span className="text-pod-red text-xs font-mono">{visible.length} podcasts</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-pod-red border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="text-center py-12 border border-pod-border rounded-xl">
              <p className="text-pod-text-secondary">{error}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 border border-pod-border rounded-xl">
              <p className="text-pod-text-secondary">{EMPTY_COPY[activeTab]}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((podcast) => {
                const downloaded = Object.prototype.hasOwnProperty.call(prefs.downloads, podcast.id);
                const favorite = prefs.favorites.includes(podcast.id);
                return (
                  <div
                    key={podcast.id}
                    className="relative flex items-center gap-2 p-3 border border-pod-border rounded-xl hover:bg-pod-elevated transition-colors"
                  >
                    <button
                      type="button"
                      aria-label={podcast.title}
                      onClick={() => openPodcast(podcast)}
                      className="flex-1 min-w-0 flex items-center gap-4 text-left min-h-11"
                    >
                      <div className="w-10 h-10 bg-pod-red rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {podcast.coverImageUrl ? (
                          <img src={podcast.coverImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            {downloaded ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            )}
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white truncate">{podcast.title}</h3>
                        <p className="text-xs text-pod-text-secondary mt-0.5">
                          {formatDuration(podcast.durationSeconds)} · {podcast.playCount} plays
                          {favorite ? ' · favori' : ''}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`${podcast.title} secenekleri`}
                      aria-expanded={openMenuId === podcast.id}
                      onClick={() => setOpenMenuId((current) => (current === podcast.id ? null : podcast.id))}
                      className="w-11 h-11 flex items-center justify-center text-pod-text-secondary hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    {openMenuId === podcast.id && (
                      <div className="absolute right-3 top-14 z-10 w-48 border border-pod-border bg-pod-bg rounded-lg shadow-lg overflow-hidden">
                        <button
                          type="button"
                          className="w-full text-left px-4 min-h-11 text-sm text-white hover:bg-pod-elevated"
                          onClick={() => { updatePrefs(toggleFavorite(prefs, podcast.id)); setOpenMenuId(null); }}
                        >
                          {favorite ? 'Favorilerden cikar' : 'Favorilere ekle'}
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-4 min-h-11 text-sm text-white hover:bg-pod-elevated"
                          onClick={() => { void handleDownload(podcast); }}
                        >
                          Indir
                        </button>
                        {downloaded && (
                          <button
                            type="button"
                            className="w-full text-left px-4 min-h-11 text-sm text-white hover:bg-pod-elevated"
                            onClick={() => {
                              const downloads = { ...prefs.downloads };
                              delete downloads[podcast.id];
                              updatePrefs({ ...prefs, downloads });
                              setOpenMenuId(null);
                            }}
                          >
                            Indirmeyi kaldir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClearCache}
            className="flex-1 min-h-12 h-12 flex items-center justify-center gap-2 border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-xs font-semibold text-white tracking-wider">CLEAR CACHE</span>
          </button>
          <button
            type="button"
            onClick={cycleSort}
            aria-label={`Siralama: ${sortLabel(prefs.sort)}`}
            className="flex-1 min-h-12 h-12 flex items-center justify-center gap-2 border border-pod-red rounded-lg hover:bg-pod-red/10 transition-colors"
          >
            <svg className="w-4 h-4 text-pod-red" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span className="text-xs font-semibold text-pod-red tracking-wider">{sortLabel(prefs.sort)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
