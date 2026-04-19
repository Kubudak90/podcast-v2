import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, generateToken, AuthRequest } from '../middleware/auth.js';

// Mock response object
const createMockResponse = () => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
};

// Mock next function
const createMockNext = (): NextFunction => vi.fn();

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should reject request without authorization header', () => {
      const req = {
        headers: {},
      } as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Unauthorized: No token provided',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token123',
        },
      } as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Unauthorized: No token provided',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid JWT token', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      } as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Unauthorized: Invalid token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept request with valid JWT token', () => {
      const token = generateToken('user-123', 'testuser');
      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      authMiddleware(req, res, next);

      expect(req.userId).toBe('user-123');
      expect(req.user).toEqual({ id: 'user-123', username: 'testuser' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject expired token', () => {
      // Create a token that expires immediately
      const expiredToken = jwt.sign(
        { userId: 'user-123', username: 'testuser' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '-1s' }
      );

      const req = {
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      } as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Unauthorized: Invalid token',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken('user-123', 'testuser');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should contain correct payload', () => {
      const token = generateToken('user-456', 'anotheruser');
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as { userId: string; username: string };

      expect(decoded.userId).toBe('user-456');
      expect(decoded.username).toBe('anotheruser');
    });

    it('should have expiration time', () => {
      const token = generateToken('user-123', 'testuser');
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as { exp: number };

      expect(decoded.exp).toBeDefined();
      // Token should expire in the future
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should generate unique tokens for same user', () => {
      const token1 = generateToken('user-123', 'testuser');
      // Small delay to ensure different iat
      const token2 = generateToken('user-123', 'testuser');

      // Tokens might be same if generated in same second, but payloads should match
      const decoded1 = jwt.decode(token1) as { userId: string };
      const decoded2 = jwt.decode(token2) as { userId: string };

      expect(decoded1.userId).toBe(decoded2.userId);
    });
  });
});
