import { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    req.userId = decoded.userId;
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
}

export function generateToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '30d' });
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    req.userId = decoded.userId;
    req.user = { id: decoded.userId, username: decoded.username };
  } catch {
    // Invalid token, but continue without auth
  }

  next();
}
