import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageTitleForPath } from '../lib/pageTitle';
import { useRoomStore } from '../lib/store';

export function RouteTitle() {
  const { pathname } = useLocation();
  const roomSlug = useRoomStore((state) => state.currentRoom?.slug ?? null);
  const roomTitle = useRoomStore((state) => state.currentRoom?.title ?? null);

  useEffect(() => {
    const title = pageTitleForPath(pathname, { roomSlug, roomTitle });
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [pathname, roomSlug, roomTitle]);

  return null;
}
