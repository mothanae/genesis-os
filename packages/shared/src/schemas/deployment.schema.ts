import { z } from 'zod';

export const deployGenerateSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  platform: z.enum(['docker', 'kubernetes']).default('docker'),
  cloudProvider: z.enum(['aws', 'gcp', 'azure']).optional(),
  region: z.string().optional(),
  domain: z.string().optional(),
});

export const deploySimulateSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  platform: z.enum(['docker', 'kubernetes']).default('kubernetes'),
  cloudProvider: z.enum(['aws', 'gcp', 'azure']).default('aws'),
});

export const rollbackSchema = z.object({
  revision: z.string().optional(),
});
