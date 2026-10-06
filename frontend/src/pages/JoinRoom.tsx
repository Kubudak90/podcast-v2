import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/UI';
import { useAuthStore } from '../lib/store';
import { parseRoomSlug, rememberPendingRoom } from '../lib/roomLink';
import { usePageTitle } from '../lib/usePageTitle';

export function JoinRoom() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  usePageTitle('Odaya katil · PodChat');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = parseRoomSlug(code);
    if (!code.trim()) {
      setError('Oda kodu veya linki girin');
      return;
    }
    if (!slug) {
      setError('Gecerli bir oda kodu veya linki girin');
      return;
    }
    if (!isAuthenticated) {
      rememberPendingRoom(slug);
      navigate('/login');
      return;
    }
    navigate(`/room/${slug}`);
  };

  return (
    <div className="min-h-screen bg-pod-bg">
      <div className="px-6 py-4">
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Geri"
            className="w-11 h-11 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-white tracking-tight">KATIL</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-sm">
          <div className="space-y-2">
            <label htmlFor="room-code" className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary uppercase">
              Oda kodu veya linki
            </label>
            <input
              id="room-code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError('');
              }}
              placeholder="abc123 veya davet linki"
              className="input"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-xs text-pod-text-secondary">
              Paylasilan linki yapistirabilir veya yalnizca oda kodunu yazabilirsin.
            </p>
          </div>

          {error && <p className="text-pod-red text-sm">{error}</p>}

          <Button type="submit" className="w-full h-14 text-sm tracking-wider">
            KATIL
          </Button>
        </form>
      </div>
    </div>
  );
}
