import { Link, useLocation } from 'react-router-dom';

const tabs = [
  {
    path: '/',
    label: 'Home',
    icon: (active: boolean) => (
      <svg className={`w-5 h-5 ${active ? 'text-pod-red' : 'text-pod-text-secondary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: '/library',
    label: 'Library',
    icon: (active: boolean) => (
      <svg className={`w-5 h-5 ${active ? 'text-pod-red' : 'text-pod-text-secondary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    path: '/create-room',
    label: 'Record',
    icon: (active: boolean) => (
      <svg className={`w-5 h-5 ${active ? 'text-pod-red' : 'text-pod-text-secondary'}`} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
      </svg>
    ),
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg className={`w-5 h-5 ${active ? 'text-pod-red' : 'text-pod-text-secondary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export function TabBar() {
  const location = useLocation();

  // Don't show tab bar on room pages, login, or signup
  const hiddenPaths = ['/login', '/signup', '/listen'];
  const isRoomPage = location.pathname.startsWith('/room/');
  const isHidden = hiddenPaths.some(p => location.pathname.startsWith(p)) || isRoomPage;

  if (isHidden) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-area-pb">
      <div className="bg-gradient-to-t from-pod-bg via-pod-bg/95 to-transparent pt-3 px-5 pb-3">
        <div className="flex items-center justify-around border border-pod-border rounded-full py-2 px-1 bg-pod-bg/80 backdrop-blur-lg">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="flex flex-col items-center gap-1 py-1.5 px-4"
              >
                {tab.icon(isActive)}
                <span className={`text-[10px] font-medium ${isActive ? 'text-pod-red' : 'text-pod-text-secondary'}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
