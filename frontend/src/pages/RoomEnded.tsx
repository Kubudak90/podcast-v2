import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../components/UI';
import { ShareModal } from '../components/ShareModal';
import { toast } from '../components/Toast';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import type { Recording, Room } from '../types';

export function RoomEnded() {
  const { slug } = useParams<{ slug: string }>();
  const userId = useAuthStore((state) => state.user?.id);
  const [room, setRoom] = useState<Room | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [shareTarget, setShareTarget] = useState<Recording | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;

      try {
        const [roomData, recordingsData] = await Promise.all([
          api.getRoom(slug),
          api.getRoomRecordings(slug),
        ]);
        setRoom(roomData);
        setRecordings(recordingsData);
        setLoadError('');
      } catch (err) {
        console.error('Failed to fetch room data:', err);
        setLoadError('Yayin bilgisi yuklenemedi');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  const handleDownload = async (recordingId: string) => {
    try {
      const { url } = await api.getRecordingDownloadUrl(recordingId);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to get download URL:', err);
      const message = err instanceof Error && err.message ? err.message : 'Kayit indirilemedi';
      toast.error(message);
    }
  };

  const handleRecordingUpdated = (updated: Recording) => {
    setRecordings((current) =>
      current.map((recording) => (recording.id === updated.id ? { ...recording, ...updated } : recording)),
    );
    setShareTarget((current) => (current && current.id === updated.id ? { ...current, ...updated } : current));
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds == null || Number.isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (bytes == null || Number.isNaN(bytes)) return '--';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pod-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-pod-red border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pod-bg flex items-center justify-center p-4">
      <div className="bg-pod-elevated border border-pod-border rounded-xl p-6 w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-pod-red/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-pod-red"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Yayin Sona Erdi</h1>
          {room && (
            <p className="text-pod-text-secondary">{room.title}</p>
          )}
        </div>

        {loadError ? (
          <p className="text-center text-pod-red mb-6">{loadError}</p>
        ) : recordings.length > 0 ? (
          <div className="space-y-3 mb-6">
            <h2 className="font-medium text-white">Kayitlar</h2>
            {recordings.map((recording) => {
              const canShare = Boolean(userId && recording.ownerId === userId);
              return (
                <div
                  key={recording.id}
                  className="flex items-center justify-between gap-3 p-3 bg-pod-bg border border-pod-border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-pod-red/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-pod-red"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {recording.title || `${recording.format.toUpperCase()} kaydi`}
                      </p>
                      <p className="text-xs text-pod-text-secondary">
                        {formatDuration(recording.durationSeconds)} -{' '}
                        {formatFileSize(recording.fileSizeBytes)}
                        {recording.isPublic ? ' · Herkese acik' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                  {recording.isPublic && recording.shareSlug && (
                      <Link
                        to={`/listen/${recording.shareSlug}`}
                        className="inline-flex items-center justify-center min-h-11 px-3 text-sm font-semibold text-white border border-pod-border rounded-lg hover:bg-pod-elevated"
                      >
                        Dinle
                      </Link>
                    )}
                    {canShare && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-11"
                        onClick={() => setShareTarget(recording)}
                      >
                        Paylas
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-h-11"
                      aria-label="Indir"
                      onClick={() => handleDownload(recording.id)}
                    >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                      </svg>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-pod-text-secondary mb-6">
            Bu yayin icin kayit bulunamadi.
          </p>
        )}

        <Link to="/">
          <Button className="w-full">Ana Sayfaya Don</Button>
        </Link>
      </div>

      {shareTarget && (
        <ShareModal
          recording={shareTarget}
          isOpen
          onClose={() => setShareTarget(null)}
          onUpdate={handleRecordingUpdated}
        />
      )}
    </div>
  );
}
