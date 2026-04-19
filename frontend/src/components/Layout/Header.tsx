import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';

export function Header() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // Don't show header on login, signup, or room pages
  const hiddenPaths = ['/login', '/signup', '/listen'];
  const isRoomPage = location.pathname.startsWith('/room/');
  const isHidden = hiddenPaths.some(p => location.pathname.startsWith(p)) || isRoomPage;

  if (isHidden) return null;

  return (
    <header className="bg-pod-bg safe-area-pt">
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-2xl font-extrabold tracking-tight text-white">PODCHAT</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/create-room"
                className="w-10 h-10 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-sm font-semibold text-pod-red hover:text-red-400 transition-colors"
              >
                Giris Yap
              </Link>
            )}
          </div>
        </div>
        <p className="text-pod-text-secondary text-xs font-mono mt-1">Live podcast with friends</p>
      </div>
    </header>
  );
}
