import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const oauthSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Room schemas
export const createRoomSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be at most 100 characters'),
  isPublic: z.boolean().optional().default(true),
  maxSpeakers: z.number().min(1).max(10).optional().default(10),
  password: z.string().min(4, 'Password must be at least 4 characters').max(50).optional(),
});

export const joinRoomSchema = z.object({
  password: z.string().optional(),
});

export const changeRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['speaker', 'listener'], {
    message: 'Role must be speaker or listener',
  }),
});

export const participantActionSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

// LiveKit schemas
export const getLiveKitTokenSchema = z.object({
  roomSlug: z.string().min(1, 'Room slug is required'),
});

// Recording schema
export const recordingUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters').optional(),
  description: z.string().max(500, 'Description must be at most 500 characters').optional().nullable(),
  isPublic: z.boolean().optional(),
});

// Profile schema
export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  email: z.string().email('Invalid email').optional().nullable(),
  bio: z.string().max(200, 'Bio must be at most 200 characters').optional().nullable(),
  avatarUrl: z.string().url('Invalid URL').optional().nullable(),
});

// Query parameter schemas for GET requests
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const roomListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(100).optional(),
  status: z.enum(['live', 'waiting']).optional(),
});

// Moderation (B4)
export const reportSchema = z.object({
  targetType: z.enum(['recording', 'room', 'message', 'user']),
  targetId: z.string().min(1, 'targetId is required').max(200),
  reason: z.enum(['spam', 'harassment', 'hate', 'sexual', 'other']),
  note: z.string().max(500).optional(),
});

export const blockSchema = z.object({
  blockedId: z.string().min(1, 'blockedId is required').max(200),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OAuthInput = z.infer<typeof oauthSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type GetLiveKitTokenInput = z.infer<typeof getLiveKitTokenSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RecordingUpdateInput = z.infer<typeof recordingUpdateSchema>;
