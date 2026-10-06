import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Avatar } from '../components/UI';
import { api } from '../lib/api';
import {
  PLAYBACK_RATES,
  clearResumePosition,
  formatPlaybackTime,
  readPlaybackRate,
  readResumePosition,
  writePlaybackRate,
  writeResumePosition,
  type PlaybackRate,
} from '../lib/playback';
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
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(() => readPlaybackRate());
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [requestCors, setRequestCors] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSavedSecond = useRef<number | null>(null);
  const playRequest = useRef(0);
  const seekingRef = useRef(false);
  const rateRef = useRef(playbackRate);
  rateRef.current = playbackRate;

  useEffect(() => {
    if (!shareSlug) return;

    let cancelled = false;
    const loadRecording = async () => {
      try {
        const data = await api.getPublicRecording(shareSlug);
        if (cancelled) return;
        setRecording(data);
        const { url } = await api.getPublicRecordingDownload(shareSlug);
        if (cancelled) return;
        setAudioUrl(url);
      } catch {
        if (!cancelled) setError('Recording not found or not public');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRecording();
    return () => {
      cancelled = true;
    };
  }, [shareSlug]);

  const persistPosition = (
    time = audioRef.current?.currentTime,
    knownDuration = audioRef.current?.duration,
    allowClearStart = false,
  ) => {
    const audioTime = time ?? 0;
    const audioDuration = knownDuration ?? 0;
    if (!shareSlug || seekingRef.current || !Number.isFinite(audioTime)) return;
    // Leaving while the file is still at 0 must not erase a bookmark the
    // resume seek has not applied yet. Start-over and an intentional seek do.
    if (audioTime < 1) {
      if (!allowClearStart) return;
      lastSavedSecond.current = 0;
      writeResumePosition(shareSlug, audioTime, audioDuration);
      return;
    }
    const second = Math.floor(audioTime);
    if (lastSavedSecond.current === second) return;
    lastSavedSecond.current = second;
    writeResumePosition(shareSlug, audioTime, audioDuration);
  };

  const persistRef = useRef(persistPosition);
  persistRef.current = persistPosition;

  useEffect(() => {
    const onHide = () => persistRef.current();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError(null);

    if (!audio.paused) {
      playRequest.current += 1;
      audio.pause();
      return;
    }

    const request = ++playRequest.current;
    let pending: Promise<void> | undefined;
    try {
      pending = audio.play();
    } catch {
      setPlaying(false);
      setPlaybackError("Couldn't play this recording. Try again.");
      return;
    }

    void Promise.resolve(pending).then(() => {
      if (request !== playRequest.current) return;
      setPlaying(true);
    }).catch(() => {
      if (request !== playRequest.current) return;
      setPlaying(false);
      setPlaybackError("Couldn't play this recording. Try again.");
    });
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || seekingRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    persistPosition();
  };

  const moveTo = (time: number) => {
    const audio = audioRef.current;
    setCurrentTime(time);
    if (!audio) return;
    seekingRef.current = true;
    audio.currentTime = time;
    if (Math.abs(audio.currentTime - time) > 0.75) {
      seekingRef.current = false;
      return;
    }
    seekingRef.current = false;
    lastSavedSecond.current = null;
    persistPosition(time, audio.duration, true);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextDuration = audio.duration;
    if (Number.isFinite(nextDuration)) setDuration(nextDuration);
    audio.playbackRate = rateRef.current;

    if (!shareSlug || !Number.isFinite(nextDuration)) return;
    const saved = readResumePosition(shareSlug, nextDuration);
    if (saved === null) return;
    moveTo(saved);
    if (Math.abs(audio.currentTime - saved) <= 0.75) setResumedAt(saved);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    moveTo(Number(e.target.value));
  };

  const applyRate = (rate: PlaybackRate) => {
    setPlaybackRate(rate);
    writePlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  const startOver = () => {
    if (shareSlug) clearResumePosition(shareSlug);
    lastSavedSecond.current = 0;
    setResumedAt(null);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const cycleRate = () => {
    const index = PLAYBACK_RATES.indexOf(playbackRate);
    const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
    applyRate(next);
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

  const maxTime = duration || recording.durationSeconds;
  const playLabel = playing ? 'Pause' : 'Play';

  const audioEl = audioUrl ? (
    <audio
      key={requestCors ? 'cors' : 'plain'}
      ref={audioRef}
      src={audioUrl}
      crossOrigin={requestCors ? 'anonymous' : undefined}
      preload="auto"
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onSeeked={() => {
        seekingRef.current = false;
      }}
      onPlay={() => setPlaying(true)}
      onPause={() => {
        setPlaying(false);
        persistPosition();
      }}
      onEnded={() => {
        setPlaying(false);
        setResumedAt(null);
        if (shareSlug) clearResumePosition(shareSlug);
        lastSavedSecond.current = null;
      }}
      onError={() => {
        setPlaying(false);
        if (requestCors) {
          setRequestCors(false);
          return;
        }
        setPlaybackError("Couldn't play this recording. Try again.");
      }}
    />
  ) : null;

  const playButton = (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={playLabel}
      className={`${isEmbed ? 'w-12 h-12' : 'w-16 h-16'} shrink-0 flex items-center justify-center bg-pod-red hover:bg-red-600 rounded-full transition-colors shadow-lg`}
    >
      {playing ? (
        <svg className={isEmbed ? 'w-5 h-5' : 'w-7 h-7'} fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
        </svg>
      ) : (
        <svg className={isEmbed ? 'w-5 h-5 ml-0.5' : 'w-7 h-7 ml-1'} fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );

  const seekBar = (
    <div className="flex-1 min-w-0">
      <input
        type="range"
        min={0}
        max={maxTime || 0}
        step={1}
        value={Math.min(currentTime, maxTime || 0)}
        onChange={handleSeek}
        aria-label="Seek"
        className="w-full h-11 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-pod-active [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pod-red [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-pod-active [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-pod-red"
      />
      <div className={`flex justify-between ${isEmbed ? 'text-xs mt-1' : 'text-sm mt-2'} text-pod-text-secondary`}>
        <span>{formatPlaybackTime(currentTime)}</span>
        <span>{formatPlaybackTime(maxTime)}</span>
      </div>
    </div>
  );

  if (isEmbed) {
    return (
      <div className="h-[180px] bg-gradient-to-br from-pod-elevated to-pod-bg p-4 flex flex-col">
        {audioEl}

        <div className="flex items-center gap-3 mb-3">
          <Avatar name={recording.host.username} src={recording.host.avatarUrl} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{recording.title}</p>
            <p className="text-sm text-pod-text-secondary truncate">by {recording.host.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1">
          {playButton}
          {seekBar}
          <button
            type="button"
            onClick={cycleRate}
            aria-label={`Playback speed ${playbackRate}×`}
            className="min-w-11 min-h-11 px-2 rounded-lg bg-pod-active text-sm text-white"
          >
            {playbackRate}×
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-pod-text-secondary mt-2 gap-2">
          <span>{recording.playCount} plays</span>
          {resumedAt !== null && (
            <button type="button" onClick={startOver} className="text-pod-red hover:text-red-400">
              Start over
            </button>
          )}
          <a href={window.location.href.replace('?embed=1', '')} target="_blank" rel="noopener noreferrer" className="text-pod-red hover:text-red-400">
            Open in PodChat
          </a>
        </div>
        {playbackError && (
          <p role="alert" className="text-xs text-red-400 truncate">{playbackError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pod-bg text-white py-8">
      {audioEl}

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

          {resumedAt !== null && (
            <p className="text-sm text-pod-text-secondary mb-4">
              Resumed at {formatPlaybackTime(resumedAt)}.{' '}
              <button type="button" onClick={startOver} className="text-pod-red hover:text-red-400 min-h-11">
                Start over
              </button>
            </p>
          )}

          <div className="flex items-center gap-4 mb-4">
            {playButton}
            {seekBar}
          </div>

          <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Playback speed">
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                aria-pressed={playbackRate === rate}
                onClick={() => applyRate(rate)}
                className={`min-h-11 min-w-11 px-3 rounded-lg text-sm transition-colors ${
                  playbackRate === rate
                    ? 'bg-pod-red text-white'
                    : 'bg-pod-active text-pod-text-secondary hover:text-white'
                }`}
              >
                {rate}×
              </button>
            ))}
          </div>

          {playbackError && (
            <p role="alert" className="text-sm text-red-400 mb-4">{playbackError}</p>
          )}

          <div className="flex items-center justify-between text-sm text-pod-text-secondary pt-4 border-t border-pod-border">
            <div className="flex items-center gap-4">
              <span>{recording.playCount} plays</span>
              <span>{new Date(recording.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="px-3 py-1.5 min-h-11 bg-pod-active hover:bg-pod-border rounded-lg transition-colors"
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
