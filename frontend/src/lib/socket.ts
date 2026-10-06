import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  const token = useAuthStore.getState().token;

  socket = io(API_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinRoomChannel(roomSlug: string): void {
  if (socket?.connected) {
    socket.emit('room:join', roomSlug);
  }
}

export function leaveRoomChannel(roomSlug: string): void {
  if (socket?.connected) {
    socket.emit('room:leave', roomSlug);
  }
}

export function requestUnmute(roomSlug: string): void {
  socket?.emit('speaker:unmute_request', { roomSlug });
}

// Types for room updates
export interface RecordingErrorPayload {
  error: string;
}

export interface RoomUpdateEvent {
  type:
    | 'status_changed'
    | 'participant_joined'
    | 'participant_left'
    | 'participant_role_changed'
    | 'participant_muted'
    | 'participant_removed'
    | 'speaker_unmute_requested'
    | 'speaker_unmute_resolved'
    | 'recording_started'
    | 'recording_stopped';
  payload:
    | ParticipantJoinedPayload
    | ParticipantLeftPayload
    | StatusChangedPayload
    | RoleChangedPayload
    | ParticipantMutedPayload
    | ParticipantRemovedPayload
    | UnmuteRequestedPayload
    | UnmuteResolvedPayload
    | RecordingErrorPayload;
}

export interface ParticipantJoinedPayload {
  userId: string;
  username: string;
  role: string;
  avatarUrl?: string | null;
}

export interface ParticipantLeftPayload {
  userId: string;
}

export interface StatusChangedPayload {
  status: string;
  isRecording?: boolean;
}

export interface RoleChangedPayload {
  userId: string;
  role: string;
}

export interface ParticipantMutedPayload {
  userId: string;
  mutedByHost: boolean;
}

export interface ParticipantRemovedPayload {
  userId: string;
}

export interface UnmuteRequestedPayload {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  requestedAt: string;
}

export interface UnmuteResolvedPayload {
  userId: string;
}
