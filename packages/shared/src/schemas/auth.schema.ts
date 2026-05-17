import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional().default([]),
  expiresAt: z.string().datetime().optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const jwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: z.enum(['user', 'moderator', 'admin']),
  iat: z.number(),
  exp: z.number(),
});
