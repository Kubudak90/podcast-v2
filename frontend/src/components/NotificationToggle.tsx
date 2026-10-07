import { useState, useEffect, useId } from 'react';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
} from '../lib/push';

export function NotificationToggle() {
  const switchId = useId();
  const descriptionId = useId();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const isSupported = isPushSupported();
      setSupported(isSupported);
      setPermission(getNotificationPermission());

      if (isSupported) {
        const isSubscribed = await isPushSubscribed();
        setSubscribed(isSubscribed);
      }
    };

    checkStatus();
  }, []);

  const handleToggle = async () => {
    if (!supported || loading) return;

    setLoading(true);
    try {
      if (subscribed) {
        const success = await unsubscribeFromPush();
        if (success) {
          setSubscribed(false);
        }
      } else {
        const success = await subscribeToPush();
        if (success) {
          setSubscribed(true);
          setPermission('granted');
        } else {
          setPermission(getNotificationPermission());
        }
      }
    } catch (error) {
      console.error('Notification toggle error:', error);
    } finally {
      setLoading(false);
    }
  };

  const interactive = supported && permission !== 'denied';
  const description = !supported
    ? 'Not supported in this browser'
    : permission === 'denied'
      ? 'Blocked - Enable in browser settings'
      : subscribed
        ? 'Receive alerts when hosts go live'
        : 'Get notified when hosts go live';

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-pod-elevated border border-pod-border rounded-lg">
      <div className="min-w-0">
        {interactive ? (
          <label htmlFor={switchId} className="font-medium text-white cursor-pointer">
            Push Notifications
          </label>
        ) : (
          <p className="font-medium text-white">Push Notifications</p>
        )}
        <p
          id={interactive ? descriptionId : undefined}
          className={`text-sm ${permission === 'denied' ? 'text-pod-red' : 'text-pod-text-secondary'}`}
        >
          {description}
        </p>
      </div>
      {interactive ? (
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={subscribed}
          aria-describedby={descriptionId}
          aria-busy={loading || undefined}
          disabled={loading}
          onClick={handleToggle}
          className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
            loading ? 'opacity-50' : ''
          }`}
        >
          <span
            aria-hidden="true"
            className={`relative h-6 w-12 rounded-full transition-colors motion-reduce:transition-none ${
              subscribed ? 'bg-pod-red' : 'bg-pod-active'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform motion-reduce:transition-none ${
                subscribed ? 'translate-x-6' : ''
              }`}
            />
          </span>
        </button>
      ) : (
        <div aria-hidden="true" className="h-6 w-12 shrink-0 rounded-full bg-pod-active opacity-50" />
      )}
    </div>
  );
}
