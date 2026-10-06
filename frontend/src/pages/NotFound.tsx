import { Link, useLocation } from 'react-router-dom';
import { usePageTitle } from '../lib/usePageTitle';

export function NotFound() {
  const location = useLocation();
  usePageTitle('Sayfa bulunamadi · PodChat');

  return (
    <div className="px-6 py-16 flex flex-col items-center text-center gap-6">
      <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary">404</p>
      <h1 className="text-4xl font-extrabold tracking-tight text-white">Bu sayfa yok</h1>
      <p className="text-sm text-pod-text-secondary max-w-sm">
        <span className="font-mono text-white break-all">{location.pathname}</span>
        {' '}PodChat icinde bir sayfa degil.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          to="/"
          className="h-14 inline-flex items-center justify-center rounded-lg bg-pod-red text-sm font-semibold tracking-wider text-white hover:bg-red-700 transition-colors"
        >
          ANA SAYFA
        </Link>
        <Link
          to="/join"
          className="h-12 inline-flex items-center justify-center rounded-lg border border-pod-border text-sm font-semibold text-white hover:bg-pod-elevated transition-colors"
        >
          Oda koduyla katil
        </Link>
      </div>
    </div>
  );
}
