import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { rejectSpeakerRequest, requestToSpeak } from '../lib/socket';
import type { SpeakerRequestResolvedPayload, SpeakerRequestedPayload } from '../lib/socket';
import { useAuthStore } from '../lib/store';
import { toast } from '../components/Toast';
import type { SpeakerRequest } from '../types';

export function useSpeakerRequests(roomSlug: string, isHost: boolean) {
  const [requests, setRequests] = useState<SpeakerRequest[]>([]);
  const [requestPending, setRequestPending] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;

    api.getSpeakerRequests(roomSlug)
      .then((data) => {
        if (!cancelled) setRequests(data.requests);
      })
      .catch((err) => {
        console.error('Speaker requests failed to load:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [roomSlug, isHost]);

  const onSpeakerRequested = useCallback((payload: SpeakerRequestedPayload) => {
    setRequests((prev) => {
      const without = prev.filter((request) => request.userId !== payload.userId);
      return [...without, payload];
    });
  }, []);

  const onSpeakerRequestResolved = useCallback((payload: SpeakerRequestResolvedPayload) => {
    setRequests((prev) => prev.filter((request) => request.userId !== payload.userId));

    const me = useAuthStore.getState().user?.id;
    if (payload.userId !== me) return;

    const wasPending = pendingRef.current;
    pendingRef.current = false;
    setRequestPending(false);
    if (!wasPending) return;
    if (payload.error) {
      toast.error(payload.error);
    } else if (!payload.accepted) {
      toast.info('Konusma istegi reddedildi');
    }
  }, []);

  const clearOwnPending = useCallback(() => {
    pendingRef.current = false;
    setRequestPending(false);
  }, []);

  const raiseHand = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setRequestPending(true);
    requestToSpeak(roomSlug);
  }, [roomSlug]);

  const acceptRequest = useCallback(async (userId: string) => {
    try {
      await api.changeRole(roomSlug, userId, 'speaker');
      setRequests((prev) => prev.filter((request) => request.userId !== userId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Istek kabul edilemedi');
    }
  }, [roomSlug]);

  const declineRequest = useCallback((userId: string) => {
    rejectSpeakerRequest(roomSlug, userId);
    setRequests((prev) => prev.filter((request) => request.userId !== userId));
  }, [roomSlug]);

  return {
    requests,
    requestPending,
    onSpeakerRequested,
    onSpeakerRequestResolved,
    clearOwnPending,
    raiseHand,
    acceptRequest,
    declineRequest,
  };
}
