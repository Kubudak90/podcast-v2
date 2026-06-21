import { AccessToken, EgressClient, EncodedFileOutput, EncodedFileType, RoomServiceClient, S3Upload } from 'livekit-server-sdk';

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

// S3/R2 config for recording uploads
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
const S3_BUCKET = process.env.S3_BUCKET || 'podchat-recordings';
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_REGION = process.env.S3_REGION || 'auto';
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true' || !S3_ACCESS_KEY || !S3_SECRET_KEY || !process.env.S3_BUCKET;
const LOCAL_RECORDINGS_DIR = process.env.LOCAL_RECORDINGS_DIR || '/recordings';

// Tokens are short-lived to limit blast radius if leaked. Clients should call
// /api/livekit/token again before expiry; LiveKit's react SDK and the iOS app
// both retry on the TokenExpired disconnect reason as a fallback.
export const LIVEKIT_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export async function createLiveKitToken(
  roomName: string,
  participantIdentity: string,
  canPublish: boolean = true
): Promise<{ token: string; expiresAt: string }> {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    ttl: LIVEKIT_TOKEN_TTL_SECONDS,
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await token.toJwt();
  const expiresAt = new Date(Date.now() + LIVEKIT_TOKEN_TTL_SECONDS * 1000).toISOString();
  return { token: jwt, expiresAt };
}

export function getLiveKitUrl(): string {
  return LIVEKIT_URL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Egress for recording
let egressClient: EgressClient | null = null;

function getEgressClient(): EgressClient {
  if (!egressClient) {
    egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
  return egressClient;
}

export async function startRoomRecording(roomName: string, timestamp: number): Promise<{ egressId: string; filepath: string; fileUrl: string }> {
  const client = getEgressClient();

  // Audio-only room-composite egress uses MP3 (a streaming container): the file
  // finalizes even on abrupt room close, and iOS plays it natively. Audio-only MP4
  // buffers in mp4mux and aborts ("Start signal not received"), leaving no file.
  const filename = `${roomName}-${timestamp}.mp3`;
  const filepath = USE_LOCAL_STORAGE ? `${LOCAL_RECORDINGS_DIR}/${filename}` : `recordings/${filename}`;

  const output = USE_LOCAL_STORAGE
    ? new EncodedFileOutput({
        filepath,
        fileType: EncodedFileType.MP3,
      })
    : new EncodedFileOutput({
        filepath,
        fileType: EncodedFileType.MP3,
        output: {
          case: 's3',
          value: new S3Upload({
            accessKey: S3_ACCESS_KEY,
            secret: S3_SECRET_KEY,
            bucket: S3_BUCKET,
            region: S3_REGION,
            endpoint: S3_ENDPOINT || undefined,
            forcePathStyle: true,
          }),
        },
      });

  let lastError: unknown;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const egress = await client.startRoomCompositeEgress(roomName, { file: output }, { audioOnly: true });

      const fileUrl = USE_LOCAL_STORAGE
        ? `local://${filepath}`
        : S3_ENDPOINT
          ? `${S3_ENDPOINT}/${S3_BUCKET}/${filepath}`
          : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${filepath}`;

      return { egressId: egress.egressId, filepath, fileUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = error;

      // LiveKit can report room non-existence briefly after the first participant joins.
      if (!message.includes('requested room does not exist') || attempt === 9) {
        break;
      }

      await sleep(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to start room recording');
}

export async function stopRoomRecording(egressId: string): Promise<void> {
  const client = getEgressClient();
  await client.stopEgress(egressId);
}

let roomServiceClient: RoomServiceClient | null = null;

export function getRoomServiceClient(): RoomServiceClient {
  if (!roomServiceClient) {
    roomServiceClient = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
  return roomServiceClient;
}

// Live permission change for a connected participant. Revoking canPublish
// auto-unpublishes their tracks (hard mute); granting it lets them speak —
// the connected client is notified immediately, no reconnect.
export async function setParticipantCanPublish(
  roomName: string,
  identity: string,
  canPublish: boolean
): Promise<void> {
  await getRoomServiceClient().updateParticipant(roomName, identity, undefined, {
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });
}

export async function removeRoomParticipant(roomName: string, identity: string): Promise<void> {
  await getRoomServiceClient().removeParticipant(roomName, identity);
}

export async function listRoomListeners(
  roomName: string
): Promise<{ count: number; sampleIdentities: string[] }> {
  const participants = await getRoomServiceClient().listParticipants(roomName);
  const listeners = participants.filter((p) => p.permission?.canPublish === false);
  return {
    count: listeners.length,
    sampleIdentities: listeners.slice(0, 8).map((p) => p.identity),
  };
}
