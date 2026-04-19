import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/UI';
import { api } from '../lib/api';
import { useAuthStore, useRoomStore } from '../lib/store';

const TOPICS = ['Technology', 'Sports', 'Music', 'News', 'Comedy', 'Business', 'Science', 'Education'];

export function CreateRoom() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { setCurrentRoom, setCurrentRoomPassword, setIsHost, setIsSpeaker } = useRoomStore();

  const [roomTitle, setRoomTitle] = useState('');
  const [topic, setTopic] = useState('Technology');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [roomPassword, setRoomPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomTitle.trim()) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) { setIsLoading(false); return; }

      const password = !isPublic ? roomPassword : undefined;
      const room = await api.createRoom(roomTitle.trim(), isPublic, password);
      setCurrentRoom(room);
      setCurrentRoomPassword(password ?? null);
      setIsHost(true);
      setIsSpeaker(true);
      navigate(`/room/${room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Oda olusturulamadi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pod-bg safe-area-pt">
      <div className="px-6 py-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-white tracking-tight">CREATE ROOM</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 max-w-sm">
          {/* Room Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary uppercase">
              Room Name
            </label>
            <input
              type="text"
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              placeholder="Friday Tech Talks"
              className="input"
              autoFocus
            />
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary uppercase">
              Topic
            </label>
            <div className="relative">
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="input appearance-none pr-10"
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-pod-text-secondary pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary uppercase">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Weekly discussion about latest tech trends, startup news, and development tips."
              className="input resize-none h-24"
              rows={3}
            />
          </div>

          {/* Privacy */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary uppercase">Privacy</p>

            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                isPublic ? 'border-pod-red' : 'border-pod-border'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm flex-shrink-0 ${isPublic ? 'bg-pod-red' : 'border border-pod-border'}`} />
              <div>
                <p className="text-sm font-medium text-white">Public</p>
                <p className="text-xs text-pod-text-secondary">Anyone can join</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
                !isPublic ? 'border-pod-red' : 'border-pod-border'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm flex-shrink-0 ${!isPublic ? 'bg-pod-red' : 'border border-pod-border'}`} />
              <div>
                <p className="text-sm font-medium text-white">Private</p>
                <p className="text-xs text-pod-text-secondary">Invite only</p>
              </div>
            </button>

            {!isPublic && (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary uppercase">
                  Room Password
                </label>
                <input
                  type="password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="En az 4 karakter"
                  className="input"
                  minLength={4}
                />
              </div>
            )}
          </div>

          {error && <p className="text-pod-red text-sm">{error}</p>}

          <Button type="submit" className="w-full h-14 text-sm tracking-wider" isLoading={isLoading}>
            START ROOM
          </Button>
        </form>
      </div>
    </div>
  );
}
