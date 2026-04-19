import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import jwt, { type SignOptions } from 'jsonwebtoken';
import path from 'node:path';

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
