import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  settings: z.record(z.unknown()).optional().default({}),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'editor', 'viewer']),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'editor', 'viewer']),
});
