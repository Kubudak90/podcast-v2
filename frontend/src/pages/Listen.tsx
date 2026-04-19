import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Avatar } from '../components/UI';
import type { PublicRecording } from '../types';

export function Listen() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';

  const [recording, setRecording] = useState<PublicRecording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!shareSlug) return;

    const loadRecording = async () => {
      try {
        const data = await api.getPublicRecording(shareSlug);
        setRecording(data);

        // Get download URL for audio
        const { url } = await api.getPublicRecordingDownload(shareSlug);
        setAudioUrl(url);
      } catch {
        setError('Recording not found or not public');
      } finally {
        setLoading(false);
      }
    };

    loadRecording();
  }, [shareSlug]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${isEmbed ? 'h-[180px]' : 'min-h-screen'} bg-pod-bg`}>
        <div className="animate-spin w-8 h-8 border-2 border-pod-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className={`flex flex-col items-center justify-center ${isEmbed ? 'h-[180px]' : 'min-h-screen'} bg-pod-bg text-white`}>
        <p className="text-pod-text-secondary mb-4">{error || 'Recording not found'}</p>
        {!isEmbed && (
          <Link to="/" className="text-pod-red hover:text-red-400">
            Go Home
          </Link>
        )}
      </div>
    );
  }

  // Embed mode - minimal player
  if (isEmbed) {
    return (
      <div className="h-[180px] bg-gradient-to-br from-pod-elevated to-pod-bg p-4 flex flex-col">
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setPlaying(false)}
          />
        )}

        <div className="flex items-center gap-3 mb-3">
          <Avatar name={recording.host.username} src={recording.host.avatarUrl} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{recording.title}</p>
            <p className="text-sm text-pod-text-secondary truncate">by {recording.host.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={togglePlay}
            className="w-12 h-12 flex items-center justify-center bg-pod-red hover:bg-red-600 rounded-full transition-colors"
          >
            {playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={duration || recording.durationSeconds}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-pod-active rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-pod-red [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between text-xs text-pod-text-secondary mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration || recording.durationSeconds)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-pod-text-secondary mt-2">
          <span>{recording.playCount} plays</span>
          <a href={window.location.href.replace('?embed=1', '')} target="_blank" rel="noopener noreferrer" className="text-pod-red hover:text-red-400">
            Open in PodChat
          </a>
        </div>
      </div>
    );
  }

  // Full page mode
  return (
    <div className="min-h-screen bg-pod-bg text-white py-8">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setPlaying(false)}
        />
      )}

      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-pod-elevated border border-pod-border rounded-xl p-6 shadow-xl">
          <div className="flex items-start gap-4 mb-6">
            <Avatar name={recording.host.username} src={recording.host.avatarUrl} size="lg" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold mb-1">{recording.title}</h1>
              <p className="text-pod-text-secondary">
                by <span className="text-pod-red">{recording.host.username}</span>
              </p>
              {recording.description && (
                <p className="text-white/80 mt-3">{recording.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={togglePlay}
              className="w-16 h-16 flex items-center justify-center bg-pod-red hover:bg-red-600 rounded-full transition-colors shadow-lg"
            >
              {playing ? (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={duration || recording.durationSeconds}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-pod-active rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-pod-red [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="flex justify-between text-sm text-pod-text-secondary mt-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration || recording.durationSeconds)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-pod-text-secondary pt-4 border-t border-pod-border">
            <div className="flex items-center gap-4">
              <span>{recording.playCount} plays</span>
              <span>{new Date(recording.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="px-3 py-1.5 bg-pod-active hover:bg-pod-border rounded-lg transition-colors"
              >
                Share
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-pod-red hover:text-red-400">
            Create your own podcast
          </Link>
        </div>
      </div>
    </div>
  );
}
