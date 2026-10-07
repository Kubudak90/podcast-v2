import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpdateParticipant, mockRemoveParticipant, mockListParticipants, mockRoomFindUnique } = vi.hoisted(() => ({
  mockUpdateParticipant: vi.fn(),
  mockRemoveParticipant: vi.fn(),
  mockListParticipants: vi.fn(),
  mockRoomFindUnique: vi.fn(),
}));

vi.mock('livekit-server-sdk', () => ({
  AccessToken: class {},
  EgressClient: class {},
  EncodedFileOutput: class {},
  EncodedFileType: { MP3: 3 },
  S3Upload: class {},
  RoomServiceClient: class {
    updateParticipant = mockUpdateParticipant;
    removeParticipant = mockRemoveParticipant;
    listParticipants = mockListParticipants;
  },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    room: { findUnique: mockRoomFindUnique },
  },
}));

import { setParticipantCanPublish, removeRoomParticipant, listRoomListeners } from '../lib/livekit.js';

describe('LiveKit RoomService helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoomFindUnique.mockResolvedValue(null);
  });

  it('setParticipantCanPublish updates permission preserving subscribe/data', async () => {
    await setParticipantCanPublish('room-slug', 'alice', false);
    expect(mockUpdateParticipant).toHaveBeenCalledWith('room-slug', 'alice', undefined, {
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
    });
  });

  it('removeRoomParticipant calls removeParticipant', async () => {
    await removeRoomParticipant('room-slug', 'bob');
    expect(mockRemoveParticipant).toHaveBeenCalledWith('room-slug', 'bob');
  });

  it('listRoomListeners counts only canPublish=false and samples first 8', async () => {
    mockListParticipants.mockResolvedValue([
      { identity: 'host', permission: { canPublish: true } },
      ...Array.from({ length: 10 }, (_, i) => ({ identity: `l${i}`, permission: { canPublish: false } })),
    ]);
    const result = await listRoomListeners('room-slug');
    expect(result.count).toBe(10);
    expect(result.sampleIdentities).toEqual(['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7']);
  });

  it('listRoomListeners skips the recorder, agents, and host-muted speakers', async () => {
    mockRoomFindUnique.mockResolvedValue({
      participants: [{ user: { username: 'muted-speaker' } }, { user: { username: 'host' } }],
    });
    mockListParticipants.mockResolvedValue([
      { identity: 'EG_recorder', kind: 2, permission: { canPublish: false, recorder: true } },
      { identity: 'agent', kind: 4, permission: { canPublish: false, agent: true } },
      { identity: 'ingress', kind: 1, permission: { canPublish: false } },
      { identity: 'hidden-listener', kind: 0, permission: { canPublish: false, hidden: true } },
      { identity: 'muted-speaker', kind: 0, permission: { canPublish: false } },
      { identity: 'host', kind: 0, permission: { canPublish: true } },
      { identity: 'listener-a', kind: 0, permission: { canPublish: false } },
      { identity: 'phone-listener', kind: 3, permission: { canPublish: false } },
    ]);

    const result = await listRoomListeners('room-slug');

    expect(mockRoomFindUnique).toHaveBeenCalledWith({
      where: { slug: 'room-slug' },
      select: {
        participants: {
          where: { leftAt: null, role: { in: ['host', 'speaker'] } },
          select: { user: { select: { username: true } } },
        },
      },
    });
    expect(result.count).toBe(2);
    expect(result.sampleIdentities).toEqual(['listener-a', 'phone-listener']);
  });

  it('listRoomListeners samples the first 8 people after dropping the recorder', async () => {
    mockListParticipants.mockResolvedValue([
      { identity: 'EG_recorder', kind: 2, permission: { canPublish: false, recorder: true } },
      ...Array.from({ length: 10 }, (_, i) => ({
        identity: `l${i}`,
        kind: 0,
        permission: { canPublish: false },
      })),
    ]);

    const result = await listRoomListeners('room-slug');
    expect(result.count).toBe(10);
    expect(result.sampleIdentities).toEqual(['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7']);
  });
});
