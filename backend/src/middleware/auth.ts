import { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();
const SESSION_PURPOSE = 'session';

type SessionClaims = { userId: string; username: string };

function bearerToken(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/.exec(raw.trim());
  return match?.[1] ?? null;
}

// File-access JWTs share this secret. They must not satisfy a session check.
function readSessionClaims(payload: unknown): SessionClaims | null {
  if (!payload || typeof payload !== 'object') return null;
  const claims = payload as Record<string, unknown>;
  const { userId, username, purpose, recordingId } = claims;
  if (typeof userId !== 'string' || userId.length === 0 || userId.length > 128) return null;
  if (typeof username !== 'string' || username.length === 0 || username.length > 50) return null;
  if (recordingId !== undefined) return null;
  if (purpose !== undefined && purpose !== SESSION_PURPOSE) return null;
  return { userId, username };
}

function verifySessionToken(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return readSessionClaims(decoded);
  } catch {
    return null;
  }
}

// `any` here intentionally — it lets route handlers `const { foo } = req.body`
// without per-route generics; zod middleware enforces shape at runtime.
export interface AuthRequest<
  P = ParamsDictionary,
  ResBody = unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ReqBody = Record<string, any>,
  ReqQuery = Query
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  userId?: string;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = bearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }

  req.userId = session.userId;
  req.user = { id: session.userId, username: session.username };
  next();
}

export async function banGuard(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) return next();
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { isBanned: true } });
  if (u?.isBanned) return res.status(403).json({ message: 'Account suspended' });
  next();
}

export async function adminGuard(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ message: 'Unauthorized' });
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { isAdmin: true } });
  if (!u?.isAdmin) return res.status(403).json({ message: 'Forbidden' });
  next();
}

export function generateToken(userId: string, username: string): string {
  return jwt.sign(
    { purpose: SESSION_PURPOSE, userId, username },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '30d' }
  );
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = bearerToken(req.headers.authorization);
  if (!token) return next();

  const session = verifySessionToken(token);
  if (session) {
    req.userId = session.userId;
    req.user = { id: session.userId, username: session.username };
  }

  next();
}
