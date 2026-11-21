/**
 * Zod schemas for categories.
 *
 * A category has translations (name/description per locale) and an optional
 * parent (for nested categories like Food > Fruits).
 */
import { z } from 'zod';

const translationSchema = z.object({
  locale: z.enum(['tj', 'ru', 'en']),
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(2000).optional(),
});

export const createCategorySchema = z.object({
  // At least one translation is required so the category has a readable name.
  translations: z.array(translationSchema).min(1, 'Provide at least one translation'),
  parentId: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(150).optional(),
});

export const updateCategorySchema = z.object({
  translations: z.array(translationSchema).min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  slug: z.string().trim().min(1).max(150).optional(),
});

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  locale: z.enum(['tj', 'ru', 'en']).optional(),
  parentId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  // "tree" returns the nested structure; otherwise a flat list.
  tree: z.coerce.boolean().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
