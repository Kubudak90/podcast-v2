import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../components/UI';
import { api } from '../lib/api';
import type { Recording, Room } from '../types';

export function RoomEnded() {
  const { slug } = useParams<{ slug: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      } catch (err) {
        console.error('Failed to fetch room data:', err);
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
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
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

        {recordings.length > 0 ? (
          <div className="space-y-3 mb-6">
            <h2 className="font-medium text-white">Kayitlar</h2>
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="flex items-center justify-between p-3 bg-pod-bg border border-pod-border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pod-red/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-pod-red"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {recording.format.toUpperCase()}
                    </p>
                    <p className="text-xs text-pod-text-secondary">
                      {formatDuration(recording.durationSeconds)} -{' '}
                      {formatFileSize(recording.fileSizeBytes)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
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
            ))}
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
    </div>
  );
}
