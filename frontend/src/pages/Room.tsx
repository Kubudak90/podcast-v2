import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button, VolumeSlider, AudioLevelMeter } from '../components/UI';
import { toast } from '../components/Toast';
import { Chat } from '../components/Chat';
import { api } from '../lib/api';
import { useAuthStore, useRoomStore, useAudioSettingsStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';
import type { Room as RoomType } from '../types';

async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error('Mikrofon izni alinamadi:', err);
    return false;
  }
}

function ParticipantTile({
  participant,
  isLocal = false,
  onVolumeChange
}: {
  participant: ReturnType<typeof useParticipants>[0];
  isLocal?: boolean;
  onVolumeChange?: (volume: number) => void;
}) {
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: true });
  const { participantVolumes, setParticipantVolume } = useAudioSettingsStore();
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioLevelRef = useRef<number>(0);

  const participantTrack = tracks.find(
    (t) => t.participant.identity === participant.identity
  );

  const isSpeaking = participantTrack?.participant.isSpeaking ?? false;
  const isMuted = !participant.isMicrophoneEnabled;

  useEffect(() => {
    if (!participantTrack?.participant) return;
    const updateAudioLevel = () => {
      const level = participantTrack.participant.audioLevel ?? 0;
      audioLevelRef.current = audioLevelRef.current * 0.7 + level * 0.3;
      setAudioLevel(audioLevelRef.current);
    };
    const interval = setInterval(updateAudioLevel, 50);
    return () => clearInterval(interval);
  }, [participantTrack]);

  const volume = participantVolumes[participant.identity] ?? 1;

  const handleVolumeChange = (newVolume: number) => {
    setParticipantVolume(participant.identity, newVolume);
    onVolumeChange?.(newVolume);
  };

  const initials = participant.identity.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex flex-col items-center gap-2 cursor-pointer"
      onClick={() => !isLocal && setShowVolumeControl(!showVolumeControl)}
    >
      <div className="relative">
        <div className={`w-20 h-20 rounded-lg flex items-center justify-center text-xl font-bold text-white border-2 transition-colors ${
          isSpeaking ? 'border-pod-red bg-pod-elevated' : isMuted ? 'border-pod-border bg-pod-active opacity-60' : 'border-pod-border bg-pod-elevated'
        }`}>
          {initials}
          {isMuted && (
            <div className="absolute -bottom-1 -right-1 bg-pod-red rounded-full p-1 z-20">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        {!isMuted && <AudioLevelMeter level={audioLevel} size="sm" barCount={5} />}
      </div>

      <span className="text-xs font-medium text-white truncate max-w-[80px]">
        @{participant.identity}
      </span>
      <span className={`text-[10px] font-semibold tracking-wider ${isSpeaking ? 'text-pod-red' : 'text-pod-text-secondary'}`}>
        {isSpeaking ? 'SPEAKING' : isMuted ? 'MUTED' : 'HOST'}
      </span>

      {!isLocal && showVolumeControl && (
        <div
          className="absolute top-full mt-2 bg-pod-elevated border border-pod-border rounded-lg p-3 shadow-lg z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 min-w-[140px]">
            <VolumeSlider value={volume} onChange={handleVolumeChange} size="sm" />
            <span className="text-xs text-pod-text-secondary w-8">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomContent({ room }: { room: RoomType }) {
  const navigate = useNavigate();
  const { isHost, isMuted, currentRoomPassword, setIsMuted, setIsSpeaker, reset } = useRoomStore();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [isLive, setIsLive] = useState(room.status === 'live');
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // Timer
  useEffect(() => {
    if (!isLive || !room.startedAt) return;
    const startTime = new Date(room.startedAt).getTime();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      setElapsedTime(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, room.startedAt]);

  const handleStatusChanged = useCallback((payload: { status: string }) => {
    if (payload.status === 'live') setIsLive(true);
    else if (payload.status === 'ended') navigate(`/room/${room.slug}/ended`);
  }, [navigate, room.slug]);

  const handleRoleChanged = useCallback((payload: { userId: string; role: string }) => {
    const currentUserId = useAuthStore.getState().user?.id;
    if (payload.userId === currentUserId) {
      const newIsSpeaker = payload.role === 'speaker' || payload.role === 'host';
      setIsSpeaker(newIsSpeaker);
      toast.info(newIsSpeaker ? 'Konusmaci oldun!' : 'Dinleyici moduna aldiniz');
    }
  }, [setIsSpeaker]);

  const handleRecordingError = useCallback((payload: { error: string }) => {
    toast.error(payload.error);
  }, []);

  useSocket({
    roomSlug: room.slug,
    onStatusChanged: handleStatusChanged,
    onRoleChanged: handleRoleChanged,
    onRecordingError: handleRecordingError,
  });

  useEffect(() => { checkMicrophonePermission().then(setMicPermission); }, []);

  useEffect(() => {
    if (localParticipant) setIsMuted(!localParticipant.isMicrophoneEnabled);
  }, [localParticipant, localParticipant?.isMicrophoneEnabled, setIsMuted]);

  const handleToggleMute = async () => {
    if (!localParticipant) return;
    if (!micPermission) {
      const hasPermission = await checkMicrophonePermission();
      setMicPermission(hasPermission);
      if (!hasPermission) { alert('Mikrofon izni gerekli.'); return; }
    }
    try {
      const newMicState = !localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newMicState);
      setIsMuted(!newMicState);
    } catch (err) {
      console.error('Mikrofon durumu degistirilemedi:', err);
    }
  };

  const handleStartRoom = async () => {
    setIsStarting(true);
    try { await api.startRoom(room.slug); setIsLive(true); toast.success('Yayin basladi!'); }
    catch { toast.error('Yayin baslatilamadi'); }
    finally { setIsStarting(false); }
  };

  const handleEndRoom = async () => {
    setIsEnding(true);
    try { await api.endRoom(room.slug); navigate(`/room/${room.slug}/ended`); }
    catch { toast.error('Yayin bitirilemedi'); setIsEnding(false); }
  };

  const handleLeave = async () => {
    try {
      await api.leaveRoom(room.slug);
    } catch (err) {
      console.warn('leaveRoom failed (continuing):', err);
    }
    reset();
    navigate('/');
  };

  const copyLink = async () => {
    const roomUrl = `${window.location.origin}/room/${room.slug}`;
    const shareText = [
      `Join me in ${room.title} on PodChat.`,
      roomUrl,
      currentRoomPassword ? `Password: ${currentRoomPassword}` : '',
    ].filter(Boolean).join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: room.title,
          text: shareText,
          url: roomUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success('Davet linki kopyalandi!');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      toast.error('Paylasim basarisiz oldu');
    }
  };

  // HOST VIEW
  if (isHost) {
    return (
      <div className="min-h-screen bg-pod-bg flex flex-col safe-area-pt">
        {/* Status bar with REC */}
        <div className="flex items-center justify-between px-6 py-3">
          <button
            onClick={handleLeave}
            className="w-10 h-10 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {isLive && (
            <div className="flex items-center gap-1.5 bg-pod-red px-2 py-1 rounded">
              <div className="w-2 h-2 bg-white rounded-full" />
              <span className="text-[11px] font-semibold text-white">REC</span>
            </div>
          )}
          <button
            onClick={() => { void copyLink(); }}
            className="w-10 h-10 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>

        {/* Room header */}
        <div className="px-6 mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">{room.title}</h1>
          <p className="text-pod-text-secondary font-mono text-sm mt-1">Host: @{useAuthStore.getState().user?.username}</p>
        </div>

        {/* Stats Cards */}
        <div className="px-6 flex gap-4 mb-6">
          <div className="flex-1 border border-pod-border rounded-xl p-6">
            <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary mb-2">LISTENERS</p>
            <p className="text-4xl font-bold text-white">{participants.length}</p>
            <p className="text-xs text-pod-text-secondary font-mono mt-1">+{Math.max(0, participants.length - 1)} Joined</p>
          </div>
          <div className="flex-1 border border-pod-border rounded-xl p-6">
            <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary mb-2">DURATION</p>
            <p className="text-4xl font-bold text-white font-mono">{elapsedTime}</p>
            <p className="text-xs text-pod-text-secondary font-mono mt-1">{isLive ? 'Recording' : 'Waiting'}</p>
          </div>
        </div>

        {/* Speakers */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary">SPEAKERS</p>
            <span className="text-pod-red text-xs font-medium">{participants.length}/10</span>
          </div>
          <div className="flex gap-6 overflow-x-auto no-scrollbar">
            {participants.map((p) => (
              <ParticipantTile
                key={p.identity}
                participant={p}
                isLocal={p.identity === localParticipant?.identity}
              />
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Controls */}
        <div className="px-6 pb-6 safe-area-pb flex gap-4">
          <Button
            variant={isMuted ? 'secondary' : 'primary'}
            className="flex-1 h-14 gap-2"
            onClick={handleToggleMute}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            {isMuted ? 'MIC OFF' : 'MIC ON'}
          </Button>

          {!isLive ? (
            <Button className="flex-1 h-14" onClick={handleStartRoom} isLoading={isStarting}>
              START
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="flex-1 h-14 gap-2"
              onClick={handleEndRoom}
              isLoading={isEnding}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              END ROOM
            </Button>
          )}
        </div>

        <RoomAudioRenderer />
        <Chat roomSlug={room.slug} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>
    );
  }

  // LISTENER VIEW
  return (
    <div className="min-h-screen bg-pod-bg flex flex-col safe-area-pt">
      {/* Header */}
      <div className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{room.title}</h1>
            <p className="text-pod-text-secondary font-mono text-sm mt-1">Host: @{room.hostId}</p>
          </div>
          <button
            onClick={handleLeave}
            className="w-10 h-10 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Live indicator + listeners */}
      <div className="flex flex-col items-center py-8">
        {isLive && (
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 bg-pod-red rounded-full animate-pulse" />
            <span className="text-pod-red text-xs font-semibold tracking-wider">LIVE NOW</span>
          </div>
        )}
        <div className="flex items-end gap-3">
          <span className="text-7xl font-extrabold text-white leading-none">{participants.length}</span>
          <span className="text-xs font-semibold tracking-widest text-pod-text-secondary mb-3">LISTENERS</span>
        </div>
        <p className="text-pod-text-secondary font-mono text-sm mt-4">Live for {elapsedTime}</p>
      </div>

      {/* Speaking Now */}
      <div className="px-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary">SPEAKING NOW</p>
        </div>
        <div className="flex justify-center gap-6">
          {participants.map((p) => (
            <ParticipantTile
              key={p.identity}
              participant={p}
              isLocal={p.identity === localParticipant?.identity}
            />
          ))}
        </div>
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="px-6 pb-6 safe-area-pb flex gap-4">
        <button className="flex-1 h-14 flex flex-col items-center justify-center gap-1 border border-pod-border rounded-xl hover:bg-pod-elevated transition-colors">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-[10px] font-semibold text-white tracking-wider">REQUEST</span>
        </button>
        <button
          onClick={() => { void copyLink(); }}
          className="flex-1 h-14 flex flex-col items-center justify-center gap-1 border border-pod-border rounded-xl hover:bg-pod-elevated transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="text-[10px] font-semibold text-white tracking-wider">SHARE</span>
        </button>
        <button
          onClick={handleLeave}
          className="flex-1 h-14 flex flex-col items-center justify-center gap-1 bg-pod-red rounded-xl hover:bg-red-700 transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-[10px] font-semibold text-white tracking-wider">LEAVE</span>
        </button>
      </div>

      <RoomAudioRenderer />
      <Chat roomSlug={room.slug} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}

export function Room() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    currentRoom,
    currentRoomPassword,
    isHost,
    isSpeaker,
    setCurrentRoom,
    setCurrentRoomPassword,
    setIsHost,
    setIsSpeaker,
  } = useRoomStore();

  const [room, setRoom] = useState<RoomType | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleConnected = useCallback(() => {}, []);

  // Refresh ~1 minute before expiry. LiveKit Cloud rotates seamlessly when a
  // fresh token is supplied via the LiveKitRoom `token` prop.
  const scheduleTokenRefresh = useCallback(
    (expiresAt: string) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const msUntilRefresh = new Date(expiresAt).getTime() - Date.now() - 60_000;
      if (msUntilRefresh <= 0 || !slug) return;
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const fresh = await api.getLiveKitToken(slug);
          setLivekitToken(fresh.token);
          setLivekitUrl(fresh.url);
          scheduleTokenRefresh(fresh.expiresAt);
        } catch (err) {
          console.error('LiveKit token refresh failed:', err);
        }
      }, msUntilRefresh);
    },
    [slug],
  );

  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const joinWithPassword = useCallback(
    async (password?: string) => {
      if (!slug) return;
      const reusableRoom = currentRoom?.slug === slug ? currentRoom : null;
      const joinPassword = password ?? (reusableRoom ? currentRoomPassword || undefined : undefined);
      const response = reusableRoom && !password
        ? {
            room: reusableRoom,
            participant: {
              role: isHost ? 'host' : isSpeaker ? 'speaker' : 'listener',
            },
          }
        : await api.joinRoom(slug, joinPassword);

      const { room: roomData, participant } = response;
      setRoom(roomData);
      setCurrentRoom(roomData);
      setCurrentRoomPassword(joinPassword ?? null);
      setIsHost(participant.role === 'host');
      setIsSpeaker(participant.role === 'host' || participant.role === 'speaker');
      const { token, url, expiresAt } = await api.getLiveKitToken(slug);
      setLivekitToken(token);
      setLivekitUrl(url);
      scheduleTokenRefresh(expiresAt);
    },
    [slug, currentRoom, currentRoomPassword, isHost, isSpeaker, setCurrentRoom, setCurrentRoomPassword, setIsHost, setIsSpeaker, scheduleTokenRefresh],
  );

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }

    const initRoom = async () => {
      if (!slug) return;
      try {
        await joinWithPassword();
      } catch (err) {
        const e = err as Error & { requiresPassword?: boolean };
        if (e.requiresPassword) {
          setNeedsPassword(true);
        } else {
          setError(e.message || 'Odaya baglanilamadi');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initRoom();
  }, [slug, isAuthenticated, navigate, joinWithPassword]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setIsSubmittingPassword(true);
    setPasswordError('');
    try {
      await joinWithPassword(passwordInput.trim());
      setNeedsPassword(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sifre dogrulanamadi';
      setPasswordError(message);
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pod-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-pod-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-pod-bg flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-pod-red mb-4">{error}</p>
          <Button onClick={() => navigate('/')}>Ana Sayfaya Don</Button>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-pod-bg flex items-center justify-center p-4">
        <form
          onSubmit={handlePasswordSubmit}
          className="w-full max-w-sm bg-pod-card rounded-xl p-6 space-y-4 border border-white/10"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Sifre korumali oda</h2>
            <p className="text-sm text-white/70 mt-1">
              Bu odaya katilmak icin host'un paylastigi sifreyi gir.
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Oda sifresi"
            className="w-full px-3 py-2 rounded-lg bg-pod-bg border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-pod-red"
          />
          {passwordError && (
            <p className="text-sm text-pod-red">{passwordError}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/')}
              disabled={isSubmittingPassword}
            >
              Iptal
            </Button>
            <Button type="submit" disabled={isSubmittingPassword || !passwordInput.trim()}>
              {isSubmittingPassword ? 'Kontrol ediliyor...' : 'Katil'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (!room || !livekitToken || !livekitUrl) return null;

  return (
    <LiveKitRoom
      token={livekitToken}
      serverUrl={livekitUrl}
      connect={true}
      audio={true}
      video={false}
      onConnected={handleConnected}
      onError={(error) => {
        console.error('LiveKit error:', error);
        setError(`Baglanti hatasi: ${error.message}`);
      }}
      options={{
        audioCaptureDefaults: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
        publishDefaults: { audioPreset: { maxBitrate: 64000 }, dtx: true, red: true },
        disconnectOnPageLeave: true,
        adaptiveStream: true,
        dynacast: true,
      }}
    >
      <RoomContent room={room} />
    </LiveKitRoom>
  );
}
