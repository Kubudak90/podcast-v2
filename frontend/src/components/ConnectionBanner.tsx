import type { SocketConnectionStatus } from '../lib/socket';

interface ConnectionBannerProps {
  status: SocketConnectionStatus;
  onRetry: () => void;
}

export function ConnectionBanner({ status, onRetry }: ConnectionBannerProps) {
  if (status !== 'reconnecting' && status !== 'disconnected') return null;

  const failed = status === 'disconnected';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="socket-connection-banner"
      className="mx-6 mt-3 flex items-center gap-3 rounded-lg border border-pod-border bg-pod-elevated px-4 py-3"
    >
      <p className="flex-1 text-sm text-white">
        {failed
          ? 'Canli baglanti kurulamadi. Sohbet ve oda durumu guncellenmiyor.'
          : 'Baglanti koptu. Yeniden deneniyor...'}
      </p>
      {failed && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 shrink-0 rounded-lg bg-pod-red px-4 text-xs font-semibold tracking-wider text-white"
        >
          Tekrar dene
        </button>
      )}
    </div>
  );
}
