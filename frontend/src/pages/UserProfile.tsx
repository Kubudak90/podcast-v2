import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { formatCount } from '../lib/format';
import { FollowButton } from '../components/FollowButton';
import { ReportDialog } from '../components/ReportDialog';
import { Button, Modal } from '../components/UI';
import { toast } from '../components/Toast';
import type { UserPodcast, UserProfile as UserProfileData } from '../types';

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [podcasts, setPodcasts] = useState<UserPodcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (!me) {
      navigate('/login');
      return;
    }
    if (!userId) {
      navigate('/');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      api.getUserProfile(userId),
      api.getUserPodcasts(userId, 20),
      api.getBlockedIds().catch(() => ({ blockedIds: [] as string[] })),
    ]).then(([nextProfile, nextPodcasts, blocks]) => {
      if (cancelled) return;
      setProfile(nextProfile);
      setPodcasts(nextPodcasts.podcasts);
      setBlocked(blocks.blockedIds.includes(userId));
    }).catch((err: unknown) => {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('not found')) setNotFound(true);
      else toast.error(message || 'Profil yuklenemedi');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [me, userId, navigate]);

  const handleUnblock = async () => {
    if (!userId) return;
    setBlocking(true);
    try {
      await api.unblockUser(userId);
      setBlocked(false);
      toast.success('Engel kaldirildi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Engel kaldirilamadi');
    } finally {
      setBlocking(false);
    }
  };

  const handleBlock = async () => {
    if (!userId) return;
    setBlocking(true);
    try {
      await api.blockUser(userId);
      setBlocked(true);
      setShowBlockConfirm(false);
      toast.success('Kullanici engellendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Engellenemedi');
    } finally {
      setBlocking(false);
    }
  };

  if (!me) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-pod-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-pod-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-pod-bg text-white px-6 py-16 text-center space-y-4">
        <p className="text-pod-text-secondary">Kullanici bulunamadi</p>
        <Link to="/" className="text-pod-red text-sm">Ana sayfa</Link>
      </div>
    );
  }

  const isSelf = me.id === profile.id;
  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-pod-bg">
      <div className="px-6 space-y-8">
        <Link to="/" className="inline-flex items-center min-h-11 text-sm text-pod-text-secondary hover:text-white">
          ← Geri
        </Link>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-24 h-24 rounded-2xl bg-pod-elevated border-[3px] border-pod-red flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
            ) : initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
            {profile.bio && <p className="text-sm text-pod-text-secondary mt-1">{profile.bio}</p>}
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-lg font-bold text-white">{formatCount(profile.followerCount)}</p>
              <p className="text-[10px] tracking-[2px] text-pod-text-secondary">FOLLOWERS</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{formatCount(profile.followingCount)}</p>
              <p className="text-[10px] tracking-[2px] text-pod-text-secondary">FOLLOWING</p>
            </div>
          </div>

          {isSelf ? (
            <Link to="/profile" className="text-sm text-pod-red min-h-11 inline-flex items-center">
              Profilini duzenle
            </Link>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <FollowButton userId={profile.id} isFollowing={profile.isFollowing} />
              {blocked ? (
                <Button type="button" variant="secondary" className="min-h-11" onClick={handleUnblock} isLoading={blocking}>
                  Engeli kaldir
                </Button>
              ) : (
                <Button type="button" variant="secondary" className="min-h-11" onClick={() => setShowBlockConfirm(true)}>
                  Engelle
                </Button>
              )}
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setShowReport(true)}>
                Bildir
              </Button>
            </div>
          )}
        </div>

        <section>
          <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary mb-4">PODCASTS</p>
          {podcasts.length === 0 ? (
            <p className="text-sm text-pod-text-secondary text-center py-6">Henuz podcast yok</p>
          ) : (
            <ul className="space-y-3">
              {podcasts.map((podcast) => {
                const inner = (
                  <>
                    <div className="w-12 h-12 rounded-lg bg-pod-elevated overflow-hidden flex items-center justify-center flex-shrink-0">
                      {podcast.coverImageUrl ? (
                        <img src={podcast.coverImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-pod-red text-xs font-bold">POD</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm text-white truncate">{podcast.title}</p>
                      <p className="text-xs text-pod-text-secondary">{formatDuration(podcast.durationSeconds)}</p>
                    </div>
                  </>
                );
                return (
                  <li key={podcast.id}>
                    {podcast.shareSlug ? (
                      <Link to={`/listen/${podcast.shareSlug}`} className="flex items-center gap-3 p-3 border border-pod-border rounded-xl hover:bg-pod-elevated min-h-11">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 p-3 border border-pod-border rounded-xl min-h-11">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ReportDialog
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="user"
        targetId={profile.id}
        targetLabel={`@${profile.username}`}
      />

      <Modal isOpen={showBlockConfirm} onClose={() => { if (!blocking) setShowBlockConfirm(false); }} title="Engelle">
        <div className="space-y-4">
          <p className="text-sm text-pod-text-secondary">
            {profile.username} engellenince icerikleri akista gizlenir.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1 min-h-11" onClick={() => setShowBlockConfirm(false)} disabled={blocking}>
              Iptal
            </Button>
            <Button type="button" className="flex-1 min-h-11" isLoading={blocking} onClick={handleBlock}>
              Engelle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
