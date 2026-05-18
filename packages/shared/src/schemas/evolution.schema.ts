import { z } from 'zod';

export const evolveSchema = z.object({
  enableSelfHealing: z.boolean().default(true),
  enableAutoUpgrade: z.boolean().default(false),
  enableInsights: z.boolean().default(true),
});
