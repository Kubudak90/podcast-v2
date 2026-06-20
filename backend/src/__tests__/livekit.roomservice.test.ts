import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateParticipant = vi.fn();
const mockRemoveParticipant = vi.fn();
const mockListParticipants = vi.fn();

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

import { setParticipantCanPublish, removeRoomParticipant, listRoomListeners } from '../lib/livekit.js';

describe('LiveKit RoomService helpers', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
