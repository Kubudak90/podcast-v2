import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import jwt, { type SignOptions } from 'jsonwebtoken';
import path from 'node:path';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
});

const BUCKET = process.env.S3_BUCKET || 'podchat-recordings';
const FRONTEND_URL = process.env.FRONTEND_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const LOCAL_RECORDINGS_DIR = path.posix.normalize(process.env.LOCAL_RECORDINGS_DIR || '/recordings');

type LocalRecordingDisposition = 'attachment' | 'inline';
type LocalRecordingTokenPayload = {
  recordingId: string;
  disposition: LocalRecordingDisposition;
};

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string = 'audio/mpeg'
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
}

export async function getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string = 'audio/mpeg',
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export function isLocalRecordingUrl(fileUrl: string): boolean {
  return fileUrl.startsWith('local://')
    || fileUrl.startsWith('file://')
    || fileUrl.startsWith(`${LOCAL_RECORDINGS_DIR}/`)
    || fileUrl === LOCAL_RECORDINGS_DIR;
}

export function getLocalRecordingPath(fileUrl: string): string {
  const normalizedSource = fileUrl.startsWith('local://') || fileUrl.startsWith('file://')
    ? new URL(fileUrl).pathname
    : fileUrl;

  const normalized = path.posix.normalize(normalizedSource);

  if (!normalized.startsWith(LOCAL_RECORDINGS_DIR)) {
    throw new Error('Invalid local recording path');
  }

  return normalized;
}

export function createLocalRecordingAccessUrl(
  recordingId: string,
  disposition: LocalRecordingDisposition = 'attachment',
  expiresIn: string = '1h'
): string {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };
  const token = jwt.sign({ recordingId, disposition }, JWT_SECRET, options);
  return `${FRONTEND_URL}/api/recordings/${recordingId}/file?token=${encodeURIComponent(token)}`;
}

export function verifyLocalRecordingAccessToken(token: string): LocalRecordingTokenPayload {
  const payload = jwt.verify(token, JWT_SECRET) as LocalRecordingTokenPayload;
  return payload;
}

export function isS3Configured(): boolean {
  return Boolean(process.env.S3_ENDPOINT);
}

// Stores an image in S3 when configured, otherwise on local disk under
// LOCAL_RECORDINGS_DIR (e.g. covers/<id>-<nanoid>.jpg). Returns the stored
// url/key to persist as Recording.coverImageKey.
export async function uploadImage(key: string, body: Buffer, contentType: string): Promise<string> {
  if (isS3Configured()) {
    return uploadFile(key, body, contentType);
  }
  const fullPath = path.posix.join(LOCAL_RECORDINGS_DIR, key);
  await mkdir(path.posix.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);
  return `local://${fullPath}`;
}

// Best-effort deletion of a previously stored image (local file or S3 object).
export async function deleteStoredFile(storedUrl: string): Promise<void> {
  try {
    if (isLocalRecordingUrl(storedUrl)) {
      await unlink(getLocalRecordingPath(storedUrl));
      return;
    }
    const url = new URL(storedUrl);
    const key = url.pathname.slice(1);
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // best-effort: a missing file or delete error must not fail the request
  }
}

// Builds the public, cache-busted cover URL exposed to clients, or null.
export function buildCoverImageUrl(
  recordingId: string,
  coverImageKey: string | null | undefined
): string | null {
  if (!coverImageKey) return null;
  const v = createHash('sha1').update(coverImageKey).digest('hex').slice(0, 12);
  return `${FRONTEND_URL}/api/recordings/${recordingId}/cover?v=${v}`;
}

// Audio uploads (B3): allowed MIME -> stored file extension.
const ALLOWED_AUDIO_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
};

export function audioExtForMime(mime: string): string | null {
  return ALLOWED_AUDIO_MIME[mime] ?? null;
}

// Directory multer disk-storage writes uploaded audio into (local mode).
export const UPLOADS_DIR = path.posix.join(LOCAL_RECORDINGS_DIR, 'uploads');

// Finalizes a multer-written temp audio file into permanent storage.
// Local mode: multer already wrote it under UPLOADS_DIR -> return its local:// URL.
// S3 mode: read it, upload to S3, remove the temp file -> return the S3 URL.
export async function storeUploadedAudio(tempPath: string, key: string, contentType: string): Promise<string> {
  if (isS3Configured()) {
    const buf = await readFile(tempPath);
    const url = await uploadFile(key, buf, contentType);
    await unlink(tempPath);
    return url;
  }
  return `local://${tempPath}`;
}
