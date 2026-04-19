import { useEffect, useCallback } from 'react';
import {
  connectSocket,
  disconnectSocket,
  joinRoomChannel,
  leaveRoomChannel,
  getSocket,
} from '../lib/socket';
import type {
  RoomUpdateEvent,
  ParticipantJoinedPayload,
  ParticipantLeftPayload,
  StatusChangedPayload,
  RoleChangedPayload,
  RecordingErrorPayload,
} from '../lib/socket';
import { useAuthStore } from '../lib/store';

interface UseSocketOptions {
  roomSlug?: string;
  onParticipantJoined?: (payload: ParticipantJoinedPayload) => void;
  onParticipantLeft?: (payload: ParticipantLeftPayload) => void;
  onStatusChanged?: (payload: StatusChangedPayload) => void;
  onRoleChanged?: (payload: RoleChangedPayload) => void;
  onRecordingError?: (payload: RecordingErrorPayload) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { roomSlug, onParticipantJoined, onParticipantLeft, onStatusChanged, onRoleChanged, onRecordingError } = options;
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = connectSocket();

    const handleRoomUpdate = (event: RoomUpdateEvent) => {
      switch (event.type) {
        case 'participant_joined':
          onParticipantJoined?.(event.payload as ParticipantJoinedPayload);
          break;
        case 'participant_left':
          onParticipantLeft?.(event.payload as ParticipantLeftPayload);
          break;
        case 'status_changed':
          onStatusChanged?.(event.payload as StatusChangedPayload);
          break;
        case 'participant_role_changed':
          onRoleChanged?.(event.payload as RoleChangedPayload);
          break;
        case 'recording_stopped':
          onRecordingError?.(event.payload as RecordingErrorPayload);
          break;
      }
    };

    socket.on('room:update', handleRoomUpdate);

    return () => {
      socket.off('room:update', handleRoomUpdate);
    };
  }, [isAuthenticated, onParticipantJoined, onParticipantLeft, onStatusChanged, onRoleChanged, onRecordingError]);

  // Join/leave room channel
  useEffect(() => {
    if (!isAuthenticated || !roomSlug) return;

    joinRoomChannel(roomSlug);

    return () => {
      leaveRoomChannel(roomSlug);
    };
  }, [isAuthenticated, roomSlug]);

  const disconnect = useCallback(() => {
    disconnectSocket();
  }, []);

  return {
    socket: getSocket(),
    disconnect,
  };
}
