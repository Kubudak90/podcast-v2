import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type SocketConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

type StatusListener = (status: SocketConnectionStatus) => void;

let socket: Socket | null = null;
let activeRoomSlug: string | null = null;
let status: SocketConnectionStatus = 'idle';
const statusListeners = new Set<StatusListener>();

function setStatus(next: SocketConnectionStatus): void {
  status = next;
  for (const listener of statusListeners) {
    listener(status);
  }
}

export function getSocketStatus(): SocketConnectionStatus {
  return status;
}

export function subscribeSocketStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getSocket(): Socket | null {
  return socket;
}

function rejoinActiveRoom(current: Socket): void {
  if (activeRoomSlug && current.connected) {
    current.emit('room:join', activeRoomSlug);
  }
}

function bindSocket(current: Socket): void {
  let hasConnected = false;

  current.on('connect', () => {
    hasConnected = true;
    setStatus('connected');
    rejoinActiveRoom(current);
  });

  current.on('disconnect', (reason) => {
    if (reason === 'io client disconnect') {
      setStatus('idle');
      return;
    }
    if (!current.active) {
      setStatus('disconnected');
      return;
    }
    setStatus(hasConnected ? 'reconnecting' : 'connecting');
  });

  current.on('connect_error', () => {
    if (!current.active) {
      setStatus('disconnected');
    }
  });

  current.io.on('reconnect_attempt', () => {
    setStatus(hasConnected ? 'reconnecting' : 'connecting');
  });

  current.io.on('reconnect_failed', () => {
    setStatus('disconnected');
  });
}

export function connectSocket(): Socket {
  if (socket) {
    if (!socket.connected && !socket.active) {
      setStatus('connecting');
      socket.connect();
    }
    return socket;
  }

  const token = useAuthStore.getState().token;

  setStatus('connecting');
  socket = io(API_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  bindSocket(socket);

  return socket;
}

export function retrySocketConnection(): void {
  if (!socket) {
    connectSocket();
    return;
  }
  if (socket.connected) {
    setStatus('connected');
    rejoinActiveRoom(socket);
    return;
  }
  setStatus('connecting');
  socket.connect();
}

export function disconnectSocket(): void {
  if (!socket) return;
  const current = socket;
  socket = null;
  activeRoomSlug = null;
  current.disconnect();
  setStatus('idle');
}

export function joinRoomChannel(roomSlug: string): void {
  activeRoomSlug = roomSlug;
  if (socket?.connected) {
    socket.emit('room:join', roomSlug);
  }
}

export function leaveRoomChannel(roomSlug: string): void {
  if (activeRoomSlug === roomSlug) {
    activeRoomSlug = null;
  }
  if (socket?.connected) {
    socket.emit('room:leave', roomSlug);
  }
}

// Types for room updates
export interface RecordingErrorPayload {
  error: string;
}

export interface RoomUpdateEvent {
  type: 'status_changed' | 'participant_joined' | 'participant_left' | 'participant_role_changed' | 'recording_started' | 'recording_stopped';
  payload: ParticipantJoinedPayload | ParticipantLeftPayload | StatusChangedPayload | RoleChangedPayload | RecordingErrorPayload;
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
