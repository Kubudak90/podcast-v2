import { useState, useEffect } from 'react';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
} from '../lib/push';

export function NotificationToggle() {
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
    if (!supported) return;

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

  if (!supported) {
    return (
      <div className="flex items-center justify-between p-4 bg-pod-elevated border border-pod-border rounded-lg">
        <div>
          <p className="font-medium text-white">Push Notifications</p>
          <p className="text-sm text-pod-text-secondary">Not supported in this browser</p>
        </div>
        <div className="w-12 h-6 bg-pod-active rounded-full opacity-50" />
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center justify-between p-4 bg-pod-elevated border border-pod-border rounded-lg">
        <div>
          <p className="font-medium text-white">Push Notifications</p>
          <p className="text-sm text-pod-red">Blocked - Enable in browser settings</p>
        </div>
        <div className="w-12 h-6 bg-pod-active rounded-full opacity-50" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-pod-elevated border border-pod-border rounded-lg">
      <div>
        <p className="font-medium text-white">Push Notifications</p>
        <p className="text-sm text-pod-text-secondary">
          {subscribed ? 'Receive alerts when hosts go live' : 'Get notified when hosts go live'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          subscribed ? 'bg-pod-red' : 'bg-pod-active'
        } ${loading ? 'opacity-50' : ''}`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            subscribed ? 'translate-x-6' : ''
          }`}
        />
      </button>
    </div>
  );
}
