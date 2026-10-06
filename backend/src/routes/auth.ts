import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, generateToken, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, oauthSchema, updateProfileSchema, forgotPasswordSchema, resetPasswordSchema } from '../lib/validation.js';
import { logAuth, logError } from '../lib/logger.js';
import { deleteStoredFile } from '../lib/storage.js';
import { devResetLinkEnabled, isSmtpConfigured, sendPasswordResetEmail } from '../lib/mail.js';
import { PASSWORD_RESET_TTL_MS, buildResetUrl, generateResetToken, hashResetToken } from '../lib/passwordReset.js';

const RESET_SENT_MESSAGE = 'If an account exists for that email, a reset link is on its way. It expires in 30 minutes.';

const router = Router();
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';

function formatUser(user: { id: string; username: string; email: string | null; avatarUrl: string | null; bio: string | null; createdAt: Date }) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
  };
}

// POST /api/auth/register (email + password)
router.post('/register', authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        authProvider: 'email',
      },
    });

    const token = generateToken(user.id, user.username);
    logAuth('register', user.id, user.username, true);

    res.status(201).json({ user: formatUser(user), token });
  } catch (error) {
    logError(error as Error, { action: 'register' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/login (email + password)
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Account suspended' });
    }

    const token = generateToken(user.id, user.username);
    logAuth('login', user.id, user.username, true);

    res.json({ user: formatUser(user), token });
  } catch (error) {
    logError(error as Error, { action: 'login' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/google
router.post('/google', authLimiter, validate(oauthSchema), async (req: Request, res: Response) => {
  try {
    const { token: accessToken } = req.body;

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return res.status(400).json({ message: 'Invalid Google token' });
    }

    const payload = await userInfoRes.json() as { sub?: string; email?: string; name?: string; picture?: string };
    if (!payload.sub || !payload.email) {
      return res.status(400).json({ message: 'Invalid Google token' });
    }

    const { sub: googleId, email, name, picture } = payload;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { authProvider: 'google', authProviderId: googleId },
          { email },
        ],
      },
    });

    if (user) {
      if (user.authProvider !== 'google') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            authProvider: 'google',
            authProviderId: googleId,
            avatarUrl: user.avatarUrl || picture || null,
          },
        });
      }
    } else {
      const baseUsername = (name || email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 40);
      let username = baseUsername;
      let counter = 1;
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}_${counter++}`;
      }

      user = await prisma.user.create({
        data: {
          username,
          email,
          authProvider: 'google',
          authProviderId: googleId,
          avatarUrl: picture || null,
        },
      });
    }

    const token = generateToken(user.id, user.username);
    logAuth('google_login', user.id, user.username, true);

    res.json({ user: formatUser(user), token });
  } catch (error) {
    logError(error as Error, { action: 'google_auth' });
    res.status(401).json({ message: 'Google authentication failed' });
  }
});

// POST /api/auth/apple
router.post('/apple', authLimiter, validate(oauthSchema), async (req: Request, res: Response) => {
  try {
    const { token: identityToken } = req.body;

    const jwks = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
    const { payload } = await jose.jwtVerify(identityToken, jwks, {
      issuer: 'https://appleid.apple.com',
      audience: APPLE_CLIENT_ID,
    });

    const appleId = payload.sub;
    const email = payload.email as string | undefined;

    if (!appleId) {
      return res.status(400).json({ message: 'Invalid Apple token' });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { authProvider: 'apple', authProviderId: appleId },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (user) {
      if (user.authProvider !== 'apple') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            authProvider: 'apple',
            authProviderId: appleId,
          },
        });
      }
    } else {
      const baseUsername = email ? email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 40) : 'user';
      let username = baseUsername;
      let counter = 1;
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}_${counter++}`;
      }

      user = await prisma.user.create({
        data: {
          username,
          email: email || null,
          authProvider: 'apple',
          authProviderId: appleId,
        },
      });
    }

    const token = generateToken(user.id, user.username);
    logAuth('apple_login', user.id, user.username, true);

    res.json({ user: formatUser(user), token });
  } catch (error) {
    logError(error as Error, { action: 'apple_auth' });
    res.status(401).json({ message: 'Apple authentication failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  try {
    const smtp = isSmtpConfigured();
    const devLink = devResetLinkEnabled();

    if (!smtp && !devLink) {
      return res.json({
        message: 'Password reset email is not configured',
        emailDelivery: 'unavailable',
      });
    }

    const email = String(req.body.email).trim();
    const user = await prisma.user.findUnique({ where: { email } });
    const recipient = user?.email;

    if (!user || user.isBanned || !recipient) {
      return res.json({
        message: RESET_SENT_MESSAGE,
        emailDelivery: smtp ? 'sent' : 'dev',
      });
    }

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt,
      },
    });

    const resetUrl = buildResetUrl(token);

    if (smtp) {
      try {
        await sendPasswordResetEmail(recipient, resetUrl);
      } catch (error) {
        logError(error as Error, { action: 'password_reset_email', userId: user.id });
      }
      return res.json({ message: RESET_SENT_MESSAGE, emailDelivery: 'sent' });
    }

    return res.json({ message: RESET_SENT_MESSAGE, emailDelivery: 'dev', devResetUrl: resetUrl });
  } catch (error) {
    logError(error as Error, { action: 'forgot_password' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token: string; password: string };
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token.trim()) },
      include: { user: true },
    });

    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    if (row.user.isBanned) {
      return res.status(403).json({ message: 'Account suspended' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: row.userId },
        data: { password: hashedPassword },
      });
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
    });

    const jwt = generateToken(row.user.id, row.user.username);
    logAuth('password_reset', row.user.id, row.user.username, true);
    res.json({ user: formatUser(row.user), token: jwt });
  } catch (error) {
    logError(error as Error, { action: 'reset_password' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(formatUser(user));
  } catch (error) {
    logError(error as Error, { action: 'me', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/rooms - Get user's room history
router.get('/rooms', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const participants = await prisma.roomParticipant.findMany({
      where: { userId: req.userId },
      include: {
        room: {
          include: {
            host: {
              select: { id: true, username: true, avatarUrl: true },
            },
            _count: {
              select: { participants: true, recordings: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const rooms = participants.map((p: typeof participants[number]) => ({
      id: p.room.id,
      slug: p.room.slug,
      title: p.room.title,
      status: p.room.status,
      isPublic: p.room.isPublic,
      host: p.room.host,
      participantCount: p.room._count.participants,
      recordingCount: p.room._count.recordings,
      role: p.role,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt?.toISOString() || null,
      startedAt: p.room.startedAt?.toISOString() || null,
      endedAt: p.room.endedAt?.toISOString() || null,
      createdAt: p.room.createdAt.toISOString(),
    }));

    res.json(rooms);
  } catch (error) {
    logError(error as Error, { action: 'get_user_rooms', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/auth/profile - Update user profile
router.patch('/profile', authMiddleware, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, bio, avatarUrl } = req.body;

    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: req.userId },
        },
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: req.userId },
        },
      });

      if (existingEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const updateData: Record<string, string | null> = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
    });

    logAuth('profile_update', user.id, user.username, true);
    res.json(formatUser(user));
  } catch (error) {
    logError(error as Error, { action: 'profile_update', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/auth/me - permanently delete the account + owned data
router.delete('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // best-effort remove stored files for recordings this user owns
    const recs = await prisma.recording.findMany({
      where: { ownerId: userId },
      select: { fileUrl: true, coverImageKey: true },
    });
    for (const r of recs) {
      if (r.fileUrl) await deleteStoredFile(r.fileUrl).catch(() => {});
      if (r.coverImageKey) await deleteStoredFile(r.coverImageKey).catch(() => {});
    }
    await prisma.$transaction(async (tx) => {
      // hosted rooms: deleting cascades their participants + chat messages; their
      // recordings' roomId becomes null (SetNull) and stay owned by the user...
      await tx.room.deleteMany({ where: { hostId: userId } });
      // ...then deleting the user cascades owned recordings, follows, reports, blocks, subscriptions.
      await tx.user.delete({ where: { id: userId } });
    });
    res.json({ message: 'Account deleted' });
  } catch (error) {
    logError(error as Error, { action: 'delete_account', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
