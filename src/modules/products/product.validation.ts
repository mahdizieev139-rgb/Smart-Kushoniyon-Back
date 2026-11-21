/**
 * Zod schemas for products.
 *
 * Note on price: we accept a number but KEEP it as a string when sending to
 * Prisma (Decimal) to avoid any floating-point rounding. Zod coerces strings
 * like "45.50" to a number for validation; the service converts back to string.
 */
import { z } from 'zod';

const translationSchema = z.object({
  locale: z.enum(['tj', 'ru', 'en']),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(5000).optional(),
});

export const createProductSchema = z.object({
  shopId: z.string().uuid('A valid shopId is required'),
  categoryId: z.string().uuid().optional(),
  // Max 10 million, 2 decimals — positive only.
  price: z.coerce.number().positive('Price must be greater than 0').max(10_000_000),
  currency: z.string().trim().length(3).toUpperCase().optional().default('TJS'),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER']).optional(),
  translations: z.array(translationSchema).min(1, 'Provide at least one translation'),
});

export const updateProductSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  price: z.coerce.number().positive().max(10_000_000).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER']).optional(),
  translations: z.array(translationSchema).min(1).optional(),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  locale: z.enum(['tj', 'ru', 'en']).optional(),
  q: z.string().trim().max(200).optional(),
  shopId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED']).optional(),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER']).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc']).optional(),
});

export const rejectSchema = z.object({ reason: z.string().trim().max(500).optional() });
export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
