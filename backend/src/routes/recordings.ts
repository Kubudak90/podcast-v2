import { Router, Response, Request } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { access, mkdir, unlink } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import {
  createLocalRecordingAccessUrl,
  getLocalRecordingPath,
  getPresignedDownloadUrl,
  isLocalRecordingUrl,
  verifyLocalRecordingAccessToken,
  uploadImage,
  deleteStoredFile,
  buildCoverImageUrl,
  UPLOADS_DIR,
  storeUploadedAudio,
  audioExtForMime,
} from '../lib/storage.js';
import { authMiddleware, AuthRequest, optionalAuthMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recordingUpdateSchema } from '../lib/validation.js';
import { logError } from '../lib/logger.js';

const router = Router();

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function coverUploadMiddleware(req: Request, res: Response, next: (err?: unknown) => void) {
  coverUpload.single('image')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image too large (max 5MB)' });
      }
      return res.status(400).json({ message: 'Invalid upload' });
    }
    next();
  });
}

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdir(UPLOADS_DIR, { recursive: true })
        .then(() => cb(null, UPLOADS_DIR))
        .catch((e) => cb(e as Error, UPLOADS_DIR));
    },
    filename: (_req, file, cb) => {
      const ext = audioExtForMime(file.mimetype) ?? 'mp3';
      cb(null, `${nanoid()}.${ext}`);
    },
  }),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, audioExtForMime(file.mimetype) !== null);
  },
});

function audioUploadMiddleware(req: Request, res: Response, next: (err?: unknown) => void) {
  audioUpload.single('audio')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Audio too large (max 200MB)' });
      }
      return res.status(400).json({ message: 'Invalid upload' });
    }
    next();
  });
}

async function buildRecordingAccessUrl(
  recordingId: string,
  fileUrl: string,
  disposition: 'attachment' | 'inline' = 'attachment'
): Promise<string> {
  if (isLocalRecordingUrl(fileUrl)) {
    const localPath = getLocalRecordingPath(fileUrl);
    await access(localPath, fsConstants.R_OK);
    return createLocalRecordingAccessUrl(recordingId, disposition);
  }

  const url = new URL(fileUrl);
  const key = url.pathname.slice(1);
  return getPresignedDownloadUrl(key);
}

// POST /api/recordings/upload - create a podcast from an uploaded audio file (owner only)
router.post('/upload', authMiddleware, audioUploadMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No valid audio file (mp3/m4a/aac, max 200MB)' });
    }
    const ext = audioExtForMime(file.mimetype);
    if (!ext) {
      await unlink(file.path).catch(() => {});
      return res.status(400).json({ message: 'Unsupported audio format' });
    }

    const key = `uploads/${path.basename(file.path)}`;
    const fileUrl = await storeUploadedAudio(file.path, key, file.mimetype);

    const titleRaw = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const fallbackTitle = file.originalname.replace(/\.[^/.]+$/, '') || 'Adsız podcast';
    const durationRaw = Number(req.body.durationSeconds);
    const durationSeconds = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : null;

    const recording = await prisma.recording.create({
      data: {
        roomId: null,
        ownerId: req.userId!,
        fileUrl,
        title: titleRaw || fallbackTitle,
        durationSeconds,
        fileSizeBytes: BigInt(file.size),
        format: ext,
        isPublic: false,
      },
    });

    res.status(201).json({
      id: recording.id,
      ownerId: recording.ownerId,
      title: recording.title,
      isPublic: recording.isPublic,
      shareSlug: recording.shareSlug,
      durationSeconds: recording.durationSeconds,
      coverImageUrl: null,
      createdAt: recording.createdAt.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'upload_audio_recording' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/:id/file - Stream/download local recording via signed token
router.get('/:id/file', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      return res.status(401).json({ message: 'Missing access token' });
    }

    const payload = verifyLocalRecordingAccessToken(token);
    if (payload.recordingId !== req.params.id) {
      return res.status(401).json({ message: 'Invalid access token' });
    }

    const recording = await prisma.recording.findUnique({
      where: { id: req.params.id },
    });

    if (!recording || !isLocalRecordingUrl(recording.fileUrl)) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    const localPath = getLocalRecordingPath(recording.fileUrl);
    await access(localPath, fsConstants.R_OK);

    const extension = path.extname(localPath).toLowerCase();
    const contentType =
      extension === '.mp4' ? 'audio/mp4'
      : extension === '.m4a' ? 'audio/mp4'
      : extension === '.aac' ? 'audio/aac'
      : extension === '.mp3' ? 'audio/mpeg'
      : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${payload.disposition}; filename="${path.basename(localPath)}"`);
    return res.sendFile(localPath);
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return res.status(404).json({ message: 'Recording file not available yet' });
    }
    logError(error as Error, { action: 'stream_local_recording' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/recordings/:id/cover - upload/replace cover image (owner only)
router.post('/:id/cover', authMiddleware, coverUploadMiddleware, async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No image provided' });
    }
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      return res.status(400).json({ message: 'Unsupported image type' });
    }

    const recording = await prisma.recording.findUnique({
      where: { id },
      select: { id: true, ownerId: true, coverImageKey: true },
    });
    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }
    if (recording.ownerId !== req.userId) {
      return res.status(403).json({ message: 'Only the owner can update this recording' });
    }

    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `covers/${id}-${nanoid()}.${ext}`;
    const storedUrl = await uploadImage(key, file.buffer, file.mimetype);

    const updated = await prisma.recording.update({
      where: { id },
      data: { coverImageKey: storedUrl },
    });

    if (recording.coverImageKey && recording.coverImageKey !== storedUrl) {
      await deleteStoredFile(recording.coverImageKey);
    }

    res.json({
      id: updated.id,
      title: updated.title,
      isPublic: updated.isPublic,
      shareSlug: updated.shareSlug,
      coverImageUrl: buildCoverImageUrl(updated.id, updated.coverImageKey),
    });
  } catch (error) {
    logError(error as Error, { action: 'upload_cover_image' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/recordings/:id/cover - remove cover image (owner only)
router.delete('/:id/cover', authMiddleware, async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const recording = await prisma.recording.findUnique({
      where: { id },
      select: { id: true, ownerId: true, coverImageKey: true },
    });
    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }
    if (recording.ownerId !== req.userId) {
      return res.status(403).json({ message: 'Only the owner can update this recording' });
    }

    const updated = await prisma.recording.update({
      where: { id },
      data: { coverImageKey: null },
    });

    if (recording.coverImageKey) {
      await deleteStoredFile(recording.coverImageKey);
    }

    res.json({
      id: updated.id,
      title: updated.title,
      isPublic: updated.isPublic,
      shareSlug: updated.shareSlug,
      coverImageUrl: null,
    });
  } catch (error) {
    logError(error as Error, { action: 'delete_cover_image' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/:id/cover - public cover image (no auth)
router.get('/:id/cover', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const recording = await prisma.recording.findUnique({
      where: { id: req.params.id },
      select: { coverImageKey: true },
    });
    if (!recording?.coverImageKey) {
      return res.status(404).json({ message: 'No cover image' });
    }

    const key = recording.coverImageKey;
    if (isLocalRecordingUrl(key)) {
      const localPath = getLocalRecordingPath(key);
      await access(localPath, fsConstants.R_OK);
      const ext = path.extname(localPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(localPath);
    }

    const url = new URL(key);
    const objectKey = url.pathname.slice(1);
    const signed = await getPresignedDownloadUrl(objectKey);
    return res.redirect(302, signed);
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return res.status(404).json({ message: 'Cover image not available' });
    }
    logError(error as Error, { action: 'get_cover_image' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/:id/download - Get download URL for a recording
router.get('/:id/download', authMiddleware, async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';

    const recording = await prisma.recording.findUnique({
      where: { id },
      include: {
        room: {
          select: { id: true },
        },
      },
    });

    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Owner may always download (covers uploaded, room-less recordings).
    if (recording.ownerId !== req.userId) {
      // Otherwise fall back to room-based authorization: the requester must have
      // been a participant in the recording's room. A room-less recording has no
      // room, so non-owners are denied.
      const participant = recording.room
        ? await prisma.roomParticipant.findFirst({
            where: {
              roomId: recording.room.id,
              userId: req.userId!,
            },
          })
        : null;

      if (!participant) {
        return res.status(403).json({ message: 'You do not have permission to download this recording' });
      }
    }

    const url = await buildRecordingAccessUrl(recording.id, recording.fileUrl, disposition);
    res.json({ url });
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      return res.status(404).json({ message: 'Recording file not available yet' });
    }
    logError(error as Error, { action: 'get_download_url' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/recordings/:id - Update recording (owner only)
router.patch('/:id', authMiddleware, validate(recordingUpdateSchema), async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, isPublic } = req.body;

    const recording = await prisma.recording.findUnique({
      where: { id },
      select: { id: true, ownerId: true, shareSlug: true, isPublic: true },
    });

    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    if (recording.ownerId !== req.userId) {
      return res.status(403).json({ message: 'Only the owner can update this recording' });
    }

    // Generate share slug if making public and no slug exists
    let shareSlug = recording.shareSlug;
    if (isPublic && !shareSlug) {
      shareSlug = nanoid(10);
    }

    const updatedRecording = await prisma.recording.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
        ...(shareSlug && { shareSlug }),
      },
    });

    res.json({
      id: updatedRecording.id,
      title: updatedRecording.title,
      description: updatedRecording.description,
      isPublic: updatedRecording.isPublic,
      shareSlug: updatedRecording.shareSlug,
      coverImageUrl: buildCoverImageUrl(updatedRecording.id, updatedRecording.coverImageKey),
      durationSeconds: updatedRecording.durationSeconds,
      createdAt: updatedRecording.createdAt.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'update_recording' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/public/:shareSlug - Get public recording by share slug
router.get('/public/:shareSlug', optionalAuthMiddleware, async (req: AuthRequest<{ shareSlug: string }>, res: Response) => {
  try {
    const { shareSlug } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { shareSlug },
      include: {
        room: {
          select: {
            id: true,
            slug: true,
            title: true,
            host: {
              select: { id: true, username: true, avatarUrl: true },
            },
          },
        },
        owner: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    if (!recording || !recording.isPublic) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Increment play count
    await prisma.recording.update({
      where: { id: recording.id },
      data: { playCount: { increment: 1 } },
    });

    res.json({
      id: recording.id,
      title: recording.title || recording.room?.title || 'Adsız podcast',
      description: recording.description,
      durationSeconds: recording.durationSeconds,
      playCount: recording.playCount + 1,
      createdAt: recording.createdAt.toISOString(),
      coverImageUrl: buildCoverImageUrl(recording.id, recording.coverImageKey),
      room: recording.room ? { id: recording.room.id, slug: recording.room.slug, title: recording.room.title } : null,
      host: recording.owner
        ? { id: recording.owner.id, username: recording.owner.username, avatarUrl: recording.owner.avatarUrl }
        : (recording.room?.host ?? null),
    });
  } catch (error) {
    logError(error as Error, { action: 'get_public_recording' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/public/:shareSlug/download - Download public recording
router.get('/public/:shareSlug/download', optionalAuthMiddleware, async (req: AuthRequest<{ shareSlug: string }>, res: Response) => {
  try {
    const { shareSlug } = req.params;
    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment';

    const recording = await prisma.recording.findUnique({
      where: { shareSlug },
    });

    if (!recording || !recording.isPublic) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    const url = await buildRecordingAccessUrl(recording.id, recording.fileUrl, disposition);
    res.json({ url });
  } catch (error) {
    logError(error as Error, { action: 'get_public_download_url' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/feed - Get public recordings feed
router.get('/feed', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where: { isPublic: true },
        include: {
          room: {
            select: {
              id: true,
              slug: true,
              title: true,
              host: {
                select: { id: true, username: true, avatarUrl: true },
              },
            },
          },
          owner: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.recording.count({ where: { isPublic: true } }),
    ]);

    res.json({
      recordings: recordings.map((r: typeof recordings[number]) => ({
        id: r.id,
        title: r.title || r.room?.title || 'Adsız podcast',
        description: r.description,
        shareSlug: r.shareSlug,
        durationSeconds: r.durationSeconds,
        playCount: r.playCount,
        createdAt: r.createdAt.toISOString(),
        coverImageUrl: buildCoverImageUrl(r.id, r.coverImageKey),
        room: r.room ? { id: r.room.id, slug: r.room.slug, title: r.room.title } : null,
        host: r.owner
          ? { id: r.owner.id, username: r.owner.username, avatarUrl: r.owner.avatarUrl }
          : (r.room?.host ?? null),
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    logError(error as Error, { action: 'get_feed' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
