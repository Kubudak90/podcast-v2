import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Handler = (...args: unknown[]) => void;

interface FakeSocket {
  connected: boolean;
  active: boolean;
  emit: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  io: { on: ReturnType<typeof vi.fn> };
  fire: (event: string, ...args: unknown[]) => void;
  fireIo: (event: string, ...args: unknown[]) => void;
}

const sockets: FakeSocket[] = [];

function createFakeSocket(): FakeSocket {
  const handlers = new Map<string, Handler[]>();
  const ioHandlers = new Map<string, Handler[]>();
  const socket: FakeSocket = {
    connected: false,
    active: true,
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, cb: Handler) => {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
    }),
    io: {
      on: vi.fn((event: string, cb: Handler) => {
        const list = ioHandlers.get(event) ?? [];
        list.push(cb);
        ioHandlers.set(event, list);
      }),
    },
    fire(event: string, ...args: unknown[]) {
      (handlers.get(event) ?? []).forEach((cb) => cb(...args));
    },
    fireIo(event: string, ...args: unknown[]) {
      (ioHandlers.get(event) ?? []).forEach((cb) => cb(...args));
    },
  };

  socket.connect.mockImplementation(() => {
    socket.active = true;
  });
  socket.disconnect.mockImplementation(() => {
    socket.connected = false;
    socket.active = false;
    socket.fire('disconnect', 'io client disconnect');
  });

  return socket;
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const socket = createFakeSocket();
    sockets.push(socket);
    return socket;
  }),
}));

import { io } from 'socket.io-client';
import {
  connectSocket,
  disconnectSocket,
  joinRoomChannel,
  leaveRoomChannel,
  retrySocketConnection,
  getSocketStatus,
} from '../lib/socket';

describe('socket connection', () => {
  beforeEach(() => {
    sockets.length = 0;
    disconnectSocket();
    vi.clearAllMocks();
  });

  afterEach(() => {
    disconnectSocket();
  });

  function latest(): FakeSocket {
    const socket = sockets.at(-1);
    if (!socket) throw new Error('socket was not created');
    return socket;
  }

  it('joins the room channel once the socket connects', () => {
    connectSocket();
    joinRoomChannel('room-a');
    expect(latest().emit).not.toHaveBeenCalled();

    latest().connected = true;
    latest().fire('connect');

    expect(latest().emit).toHaveBeenCalledWith('room:join', 'room-a');
    expect(getSocketStatus()).toBe('connected');
  });

  it('rejoins the same room after a later connect', () => {
    connectSocket();
    joinRoomChannel('room-a');
    latest().connected = true;
    latest().fire('connect');
    latest().emit.mockClear();

    latest().fire('disconnect', 'transport close');
    expect(getSocketStatus()).toBe('reconnecting');

    latest().connected = true;
    latest().fire('connect');
    expect(latest().emit).toHaveBeenCalledWith('room:join', 'room-a');
  });

  it('does not rejoin after the room channel is left', () => {
    connectSocket();
    joinRoomChannel('room-a');
    leaveRoomChannel('room-a');

    latest().connected = true;
    latest().fire('connect');

    expect(latest().emit).not.toHaveBeenCalled();
  });

  it('marks the connection failed when retries are exhausted', () => {
    connectSocket();
    latest().connected = true;
    latest().fire('connect');

    latest().active = false;
    latest().fireIo('reconnect_failed');

    expect(getSocketStatus()).toBe('disconnected');
  });

  it('retries a failed connection without opening a second socket', () => {
    connectSocket();
    latest().fireIo('reconnect_failed');
    expect(getSocketStatus()).toBe('disconnected');

    retrySocketConnection();

    expect(io).toHaveBeenCalledTimes(1);
    expect(latest().connect).toHaveBeenCalled();
    expect(getSocketStatus()).toBe('connecting');
  });

  it('reuses the existing socket while it is still connecting', () => {
    connectSocket();
    connectSocket();
    expect(io).toHaveBeenCalledTimes(1);
  });
});
