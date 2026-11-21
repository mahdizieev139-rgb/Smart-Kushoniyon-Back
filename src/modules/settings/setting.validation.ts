/**
 * Zod schemas for system settings (key/value store).
 */
import { z } from 'zod';

export const upsertSettingSchema = z.object({
  key: z.string().trim().min(1).max(100),
  // value can be any JSON (object, array, string, number, boolean).
  value: z.any(),
});

export const keyParamSchema = z.object({ key: z.string().trim().min(1).max(100) });

export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>;
