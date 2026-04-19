import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createRoomSchema,
  joinRoomSchema,
  changeRoleSchema,
  updateProfileSchema,
} from '../lib/validation.js';

const validRegister = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'pass1234',
};

const validLogin = {
  email: 'test@example.com',
  password: 'pass1234',
};

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should accept valid username + email + password', () => {
      const result = registerSchema.safeParse(validRegister);
      expect(result.success).toBe(true);
    });

    it('should accept username with numbers and underscores', () => {
      const result = registerSchema.safeParse({ ...validRegister, username: 'test_user123' });
      expect(result.success).toBe(true);
    });

    it('should reject username shorter than 2 characters', () => {
      const result = registerSchema.safeParse({ ...validRegister, username: 'a' });
      expect(result.success).toBe(false);
    });

    it('should reject username with special characters', () => {
      const result = registerSchema.safeParse({ ...validRegister, username: 'test@user' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({ ...validRegister, email: 'invalid-email' });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 6 characters', () => {
      const result = registerSchema.safeParse({ ...validRegister, password: '12345' });
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const result = registerSchema.safeParse({
        username: 'testuser',
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid email + password', () => {
      const result = loginSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({ ...validLogin, email: 'not-an-email' });
      expect(result.success).toBe(false);
    });
  });

  describe('createRoomSchema', () => {
    it('should accept valid room with title only', () => {
      const result = createRoomSchema.safeParse({ title: 'Test Room' });
      expect(result.success).toBe(true);
    });

    it('should accept room with all options', () => {
      const result = createRoomSchema.safeParse({
        title: 'Private Room',
        isPublic: false,
        maxSpeakers: 5,
        password: 'secret123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = createRoomSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 4 characters', () => {
      const result = createRoomSchema.safeParse({
        title: 'Test Room',
        password: '123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject maxSpeakers greater than 10', () => {
      const result = createRoomSchema.safeParse({
        title: 'Test Room',
        maxSpeakers: 15,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('joinRoomSchema', () => {
    it('should accept empty object (public room)', () => {
      const result = joinRoomSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept password', () => {
      const result = joinRoomSchema.safeParse({ password: 'secret123' });
      expect(result.success).toBe(true);
    });
  });

  describe('changeRoleSchema', () => {
    it('should accept valid role change to speaker', () => {
      const result = changeRoleSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'speaker',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid role change to listener', () => {
      const result = changeRoleSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'listener',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const result = changeRoleSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'admin',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUID', () => {
      const result = changeRoleSchema.safeParse({
        userId: 'not-a-uuid',
        role: 'speaker',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateProfileSchema', () => {
    it('should accept valid profile update', () => {
      const result = updateProfileSchema.safeParse({
        username: 'newusername',
        email: 'new@example.com',
        bio: 'Hello, I am a podcast enthusiast!',
      });
      expect(result.success).toBe(true);
    });

    it('should accept partial update', () => {
      const result = updateProfileSchema.safeParse({
        bio: 'Just a short bio',
      });
      expect(result.success).toBe(true);
    });

    it('should reject bio longer than 200 characters', () => {
      const result = updateProfileSchema.safeParse({
        bio: 'a'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it('should accept null values for clearing fields', () => {
      const result = updateProfileSchema.safeParse({
        email: null,
        bio: null,
      });
      expect(result.success).toBe(true);
    });
  });
});
