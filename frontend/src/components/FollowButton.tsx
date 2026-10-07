import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: 'sm' | 'md';
}

function hoverQuery(): MediaQueryList | null {
  if (typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(hover: hover)');
}

export function FollowButton({
  userId,
  isFollowing: followingProp,
  onFollowChange,
  size = 'md',
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(followingProp);
  const [loading, setLoading] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(() => hoverQuery()?.matches ?? true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setIsFollowing(followingProp);
  }, [followingProp, userId]);

  useEffect(() => {
    const query = hoverQuery();
    if (!query) return;
    const update = () => setHoverCapable(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(userId);
        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        await api.followUser(userId);
        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-2';
  const showUnfollow = isFollowing && (!hoverCapable || revealed);
  const label = loading ? '...' : showUnfollow ? 'Unfollow' : isFollowing ? 'Following' : 'Follow';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-pressed={isFollowing}
      aria-busy={loading || undefined}
      aria-label={isFollowing ? 'Unfollow' : 'Follow'}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onFocus={() => setRevealed(true)}
      onBlur={() => setRevealed(false)}
      className={`${sizeClasses} min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        showUnfollow || !isFollowing
          ? 'bg-pod-red text-white border border-pod-red hover:bg-red-600'
          : 'bg-pod-active border border-pod-border text-white'
      }`}
    >
      {label}
    </button>
  );
}
