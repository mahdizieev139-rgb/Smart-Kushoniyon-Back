/**
 * Zod schemas for shops.
 */
import { z } from 'zod';

const translationSchema = z.object({
  locale: z.enum(['tj', 'ru', 'en']),
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(3000).optional(),
});

export const createShopSchema = z.object({
  translations: z.array(translationSchema).min(1, 'Provide at least one translation'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number')
    .optional(),
  sectionId: z.string().uuid().optional(),
  // v2: physical stall number for market navigation.
  shopNumber: z.string().trim().max(50).optional(),
  slug: z.string().trim().min(1).max(150).optional(),
});

export const updateShopSchema = z.object({
  translations: z.array(translationSchema).min(1).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/)
    .optional(),
  sectionId: z.string().uuid().nullable().optional(),
  shopNumber: z.string().trim().max(50).nullable().optional(),
  slug: z.string().trim().min(1).max(150).optional(),
});

export const listShopsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  locale: z.enum(['tj', 'ru', 'en']).optional(),
  q: z.string().trim().max(150).optional(),
  sectionId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
  sort: z.enum(['newest', 'oldest', 'name']).optional(),
});

export const rejectSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });
export const slugParamSchema = z.object({ slug: z.string().trim().min(1) });

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
export type ListShopsQuery = z.infer<typeof listShopsQuerySchema>;
