import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Modal } from '../components/UI';
import { api } from '../lib/api';
import { useAuthStore, useRoomStore } from '../lib/store';
import type { PublicRoom } from '../types';

const CATEGORIES = ['TECH', 'SPORTS', 'MUSIC', 'NEWS', 'COMEDY', 'BUSINESS'];

export function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { setCurrentRoom, setCurrentRoomPassword, setIsHost, setIsSpeaker } = useRoomStore();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomSlug, setRoomSlug] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TECH');

  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPublicRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    try {
      const response = await api.getPublicRooms({
        limit: 20,
        search: searchQuery || undefined,
      });
      setPublicRooms(response.rooms);
    } catch (err) {
      console.error('Failed to fetch public rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchPublicRooms();
  }, [fetchPublicRooms]);

  useEffect(() => {
    const interval = setInterval(fetchPublicRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchPublicRooms]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'granted') return true;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error('Mikrofon izni alinamadi:', err);
      setError('Mikrofon izni gerekli.');
      return false;
    }
  }, []);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomSlug.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) { setIsLoading(false); return; }

      const slug = roomSlug.trim().replace(/.*\/room\//, '');
      const { room, participant } = await api.joinRoom(slug, joinPassword || undefined);
      setCurrentRoom(room);
      setCurrentRoomPassword(joinPassword || null);
      setIsHost(participant.role === 'host');
      setIsSpeaker(participant.role === 'host' || participant.role === 'speaker');
      navigate(`/room/${slug}`);
    } catch (err: unknown) {
      const error = err as { message?: string; requiresPassword?: boolean };
      if (error.requiresPassword) {
        setRequiresPassword(true);
        setError('Bu oda sifre ile korunuyor');
      } else {
        setError(error.message || 'Odaya katilamadi');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinPublicRoom = async (room: PublicRoom) => {
    if (!isAuthenticated) { navigate('/login'); return; }

    if (room.hasPassword) {
      setRoomSlug(room.slug);
      setRequiresPassword(true);
      setShowJoinModal(true);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) { setIsLoading(false); return; }

      const { room: joinedRoom, participant } = await api.joinRoom(room.slug);
      setCurrentRoom(joinedRoom);
      setCurrentRoomPassword(null);
      setIsHost(participant.role === 'host');
      setIsSpeaker(participant.role === 'host' || participant.role === 'speaker');
      navigate(`/room/${room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odaya katilamadi');
    } finally {
      setIsLoading(false);
    }
  };

  const liveRooms = publicRooms.filter(r => r.status === 'live');
  const totalListeners = publicRooms.reduce((acc, r) => acc + r.participantCount, 0);

  return (
    <div className="min-h-screen bg-pod-bg">
      <div className="px-6 space-y-8">
        {/* Hero - Live Now */}
        <section>
          <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary mb-4">LIVE NOW</p>
          <div className="flex items-end gap-3">
            <span className="text-8xl font-extrabold text-white leading-none tracking-tighter">
              {liveRooms.length}
            </span>
            <div className="mb-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-pod-red" />
              <span className="text-xs font-semibold tracking-widest text-pod-text-secondary">ROOMS</span>
            </div>
          </div>
          <p className="text-pod-text-secondary font-mono text-sm mt-4">
            {totalListeners.toLocaleString()} active listeners
          </p>
        </section>

        {/* Search */}
        <div className="flex items-center gap-3 px-4 h-12 border border-pod-border rounded-lg">
          <svg className="w-[18px] h-[18px] text-pod-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms or hosts..."
            className="bg-transparent text-sm text-white placeholder-pod-text-secondary outline-none flex-1"
          />
        </div>

        {/* Categories */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary">CATEGORIES</p>
            <button className="text-pod-text-secondary hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs font-semibold tracking-wider rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-pod-red text-white'
                    : 'border border-pod-border text-white hover:bg-pod-elevated'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Active Rooms */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary">ACTIVE ROOMS</p>
            {!isAuthenticated && (
              <Link to="/login" className="text-pod-red text-xs font-medium">
                Login to join
              </Link>
            )}
          </div>

          {isLoadingRooms ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-pod-red border-t-transparent rounded-full" />
            </div>
          ) : publicRooms.length === 0 ? (
            <div className="text-center py-12 border border-pod-border rounded-xl">
              <p className="text-pod-text-secondary mb-4">Henuz acik oda yok</p>
              {isAuthenticated ? (
                <Link to="/create-room">
                  <Button>Ilk Odayi Sen Olustur</Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button>Giris Yap</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {publicRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleJoinPublicRoom(room)}
                  className="w-full flex items-center gap-4 p-4 border border-pod-border rounded-xl hover:bg-pod-elevated transition-colors text-left"
                >
                  <div className="w-12 h-12 bg-pod-elevated rounded-lg flex items-center justify-center flex-shrink-0 border border-pod-border">
                    {room.status === 'live' && <div className="w-3 h-3 bg-pod-red rounded-sm" />}
                    {room.status === 'waiting' && (
                      <svg className="w-5 h-5 text-pod-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{room.title}</h3>
                    <p className="text-xs text-pod-text-secondary mt-0.5">
                      @{room.host.username} · {room.participantCount} listeners
                    </p>
                  </div>
                  <div className="w-3 h-3 bg-pod-red rounded-sm flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Join Room Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setRoomSlug('');
          setJoinPassword('');
          setRequiresPassword(false);
          setError('');
        }}
        title="Odaya Katil"
      >
        <form onSubmit={handleJoinRoom} className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase mb-2">
              Oda Linki veya Kodu
            </label>
            <input
              type="text"
              value={roomSlug}
              onChange={(e) => setRoomSlug(e.target.value)}
              placeholder="abc123"
              className="input"
              autoFocus
            />
          </div>

          {requiresPassword && (
            <div>
              <label className="block text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase mb-2">
                Oda Sifresi
              </label>
              <input
                type="password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="Sifre girin"
                className="input"
                required
              />
            </div>
          )}

          {error && <p className="text-pod-red text-sm">{error}</p>}
          <Button type="submit" className="w-full h-14" isLoading={isLoading}>
            KATIL
          </Button>
        </form>
      </Modal>
    </div>
  );
}
