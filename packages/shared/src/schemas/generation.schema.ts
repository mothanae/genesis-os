import { z } from 'zod';

export const generateCodeSchema = z.object({
  targetStack: z.enum(['react', 'nextjs', 'nodejs']).default('nodejs'),
  outputDir: z.string().optional(),
  persist: z.boolean().default(false),
  options: z.record(z.unknown()).default({}),
});

export const executeLoopSchema = z.object({
  targetStack: z.enum(['react', 'nextjs', 'nodejs']).default('nodejs'),
  options: z.record(z.unknown()).default({}),
});
