/**
 * Zod schemas for gates (market entrances).
 *
 * Coordinates are OPTIONAL — we do not invent real positions. They stay null
 * until physically verified.
 */
import { z } from 'zod';

const nameTranslationSchema = z.object({
  locale: z.enum(['tj', 'ru', 'en']),
  name: z.string().trim().min(1).max(150),
});

// Latitude/longitude ranges validated so bad coordinates are rejected.
const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

export const createGateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  translations: z.array(nameTranslationSchema).min(1),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateGateSchema = z.object({
  code: z.string().trim().min(1).max(50).optional(),
  translations: z.array(nameTranslationSchema).min(1).optional(),
  latitude: latitude.nullable().optional(),
  longitude: longitude.nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const listGatesQuerySchema = z.object({
  locale: z.enum(['tj', 'ru', 'en']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateGateInput = z.infer<typeof createGateSchema>;
export type UpdateGateInput = z.infer<typeof updateGateSchema>;
