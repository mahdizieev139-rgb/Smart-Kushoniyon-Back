/**
 * Zod schemas for sections (rows/areas that belong to a gate).
 */
import { z } from 'zod';

const translationSchema = z.object({
  locale: z.enum(['tj', 'ru', 'en']),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional(),
});

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);
const relativePos = z.coerce.number().min(0).max(1);

export const createSectionSchema = z.object({
  gateId: z.string().uuid('A valid gateId is required'),
  code: z.string().trim().min(1).max(50),
  rowNumber: z.string().trim().max(50).optional(),
  translations: z.array(translationSchema).min(1),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
  posX: relativePos.optional(),
  posY: relativePos.optional(),
  isDemo: z.coerce.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateSectionSchema = z.object({
  gateId: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(50).optional(),
  rowNumber: z.string().trim().max(50).nullable().optional(),
  translations: z.array(translationSchema).min(1).optional(),
  latitude: latitude.nullable().optional(),
  longitude: longitude.nullable().optional(),
  posX: relativePos.nullable().optional(),
  posY: relativePos.nullable().optional(),
  isDemo: z.coerce.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const listSectionsQuerySchema = z.object({
  locale: z.enum(['tj', 'ru', 'en']).optional(),
  gateId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
