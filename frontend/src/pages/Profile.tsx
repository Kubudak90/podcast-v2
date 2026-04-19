import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { Button, Modal } from '../components/UI';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../components/Toast';
import type { RoomHistoryItem } from '../types';

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) { if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; } }
        else { if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; } }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context alinamadi')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Resim yuklenemedi'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Dosya okunamadi'));
    reader.readAsDataURL(file);
  });
}

export function Profile() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [roomHistory, setRoomHistory] = useState<RoomHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoomHistory = async () => {
      try {
        const rooms = await api.getRoomHistory(20);
        setRoomHistory(rooms);
      } catch (err) {
        console.error('Failed to fetch room history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchRoomHistory();
  }, []);

  const handleLogout = () => {
    api.setToken(null);
    logout();
    navigate('/');
  };

  const openEditModal = () => {
    if (user) {
      setEditUsername(user.username);
      setEditEmail(user.email || '');
      setEditBio(user.bio || '');
      setEditAvatarUrl(user.avatarUrl || null);
      setError('');
    }
    setShowEditModal(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Lutfen bir resim dosyasi secin'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Dosya boyutu 5MB\'dan kucuk olmali'); return; }
    setIsUploadingAvatar(true);
    try { setEditAvatarUrl(await resizeImage(file, 200)); } catch { toast.error('Resim yuklenirken hata olustu'); }
    finally { setIsUploadingAvatar(false); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUsername.trim()) { setError('Kullanici adi gerekli'); return; }
    setIsLoading(true);
    setError('');
    try {
      const updatedUser = await api.updateProfile({
        username: editUsername.trim(),
        email: editEmail.trim() || null,
        bio: editBio.trim() || null,
        avatarUrl: editAvatarUrl,
      });
      updateUser(updatedUser);
      setShowEditModal(false);
      toast.success('Profil guncellendi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil guncellenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) { navigate('/login'); return null; }

  const hostedRooms = roomHistory.filter(r => r.role === 'host').length;
  const totalListeningHours = Math.round(roomHistory.reduce((acc, r) => {
    if (r.leftAt && r.joinedAt) return acc + (new Date(r.leftAt).getTime() - new Date(r.joinedAt).getTime()) / 3600000;
    return acc;
  }, 0));

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-pod-bg">
      <div className="px-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight">PROFILE</h1>
          <button className="w-10 h-10 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Avatar & Info */}
        <div className="flex flex-col items-center gap-6">
          <div className="w-28 h-28 rounded-2xl bg-pod-elevated border-[3px] border-pod-red flex items-center justify-center text-3xl font-bold text-white">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} className="w-full h-full rounded-2xl object-cover" />
            ) : initials}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{user.username}</h2>
            <p className="text-pod-text-secondary text-sm font-mono">@{user.username.toLowerCase()}</p>
            {user.bio && <p className="text-pod-text-secondary text-xs mt-1">{user.bio}</p>}
          </div>
          <button
            onClick={openEditModal}
            className="px-5 py-2 border border-pod-border rounded-lg text-xs font-semibold text-white hover:bg-pod-elevated transition-colors tracking-wider"
          >
            EDIT PROFILE
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div className="flex-1 border border-pod-border rounded-xl p-6 text-center">
            <p className="text-2xl font-bold text-white">1.2K</p>
            <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary mt-1">FOLLOWERS</p>
          </div>
          <div className="flex-1 border border-pod-border rounded-xl p-6 text-center">
            <p className="text-2xl font-bold text-white">342</p>
            <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary mt-1">FOLLOWING</p>
          </div>
        </div>

        {/* Activity */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary">ACTIVITY</p>
            <button className="text-pod-red text-xs font-medium">This week</button>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-pod-elevated border border-pod-border rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-pod-red">{hostedRooms}</p>
              <p className="text-[9px] text-pod-text-secondary font-mono mt-1">Rooms Hosted</p>
            </div>
            <div className="flex-1 bg-pod-elevated border border-pod-border rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-white">{totalListeningHours}h</p>
              <p className="text-[9px] text-pod-text-secondary font-mono mt-1">Listening</p>
            </div>
            <div className="flex-1 bg-pod-elevated border border-pod-border rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-white">{roomHistory.length}</p>
              <p className="text-[9px] text-pod-text-secondary font-mono mt-1">Total Joins</p>
            </div>
          </div>
        </section>

        {/* Recent Podcasts */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary">RECENT PODCASTS</p>
            <button className="text-pod-red text-xs font-medium">See all</button>
          </div>
          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-pod-red border-t-transparent rounded-full" />
            </div>
          ) : roomHistory.length === 0 ? (
            <p className="text-pod-text-secondary text-sm text-center py-6">Henuz podcast yok</p>
          ) : (
            <div className="space-y-3">
              {roomHistory.slice(0, 3).map((room) => (
                <Link
                  key={room.id}
                  to={room.status === 'ended' ? `/room/${room.slug}/ended` : `/room/${room.slug}`}
                  className="flex items-center gap-4 p-3 border border-pod-border rounded-xl hover:bg-pod-elevated transition-colors"
                >
                  <div className="w-10 h-10 bg-pod-red rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{room.title}</h3>
                    <p className="text-xs text-pod-text-secondary">@{room.host.username}</p>
                  </div>
                  <svg className="w-4 h-4 text-pod-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Settings Menu */}
        <section className="space-y-0">
          <button className="w-full flex items-center justify-between p-4 border border-pod-border rounded-t-xl hover:bg-pod-elevated transition-colors">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-sm text-white">Notifications</span>
            </div>
            <svg className="w-4 h-4 text-pod-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="w-full flex items-center justify-between p-4 border-x border-pod-border hover:bg-pod-elevated transition-colors">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm text-white">Privacy</span>
            </div>
            <svg className="w-4 h-4 text-pod-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 border border-pod-border rounded-b-xl hover:bg-pod-elevated transition-colors"
          >
            <svg className="w-5 h-5 text-pod-red" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-sm text-pod-red font-medium">Logout</span>
          </button>
        </section>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setError(''); }}
        title="Profili Duzenle"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="flex flex-col items-center gap-3 pb-4 border-b border-pod-border">
            <div className="relative w-20 h-20 rounded-2xl bg-pod-elevated border-2 border-pod-red flex items-center justify-center text-xl font-bold text-white overflow-hidden">
              {editAvatarUrl ? (
                <img src={editAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : editUsername.slice(0, 2).toUpperCase()}
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="animate-spin w-6 h-6 border-2 border-pod-red border-t-transparent rounded-full" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar}>
                Foto Sec
              </Button>
              {editAvatarUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditAvatarUrl(null)}>Kaldir</Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">Username</label>
            <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="input" minLength={2} maxLength={50} required />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">Email</label>
            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="ornek@mail.com" className="input" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">Bio</label>
            <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Kendinizden bahsedin..." className="input resize-none" rows={3} maxLength={200} />
          </div>

          {error && <p className="text-pod-red text-sm">{error}</p>}

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowEditModal(false); setError(''); }}>
              Iptal
            </Button>
            <Button type="submit" className="flex-1" isLoading={isLoading}>
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
