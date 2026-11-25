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

// v2: all valid availability values (added LIMITED_STOCK + UNKNOWN).
const availabilityEnum = z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'LIMITED_STOCK', 'UNKNOWN', 'PREORDER']);

// v2: free-form product attributes/specs, e.g. { "size": "60x60", "color": "white" }.
const attributesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export const createProductSchema = z.object({
  shopId: z.string().uuid('A valid shopId is required'),
  categoryId: z.string().uuid().optional(),
  // Max 10 million, 2 decimals — positive only.
  price: z.coerce.number().positive('Price must be greater than 0').max(10_000_000),
  currency: z.string().trim().length(3).toUpperCase().optional().default('TJS'),
  availability: availabilityEnum.optional(),
  // v2 inventory + comparison fields (all optional).
  stockQuantity: z.coerce.number().int().nonnegative().max(1_000_000).optional(),
  stockUnit: z.string().trim().max(20).optional(),
  brand: z.string().trim().max(120).optional(),
  attributes: attributesSchema.optional(),
  translations: z.array(translationSchema).min(1, 'Provide at least one translation'),
});

export const updateProductSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  price: z.coerce.number().positive().max(10_000_000).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  availability: availabilityEnum.optional(),
  stockQuantity: z.coerce.number().int().nonnegative().max(1_000_000).optional(),
  stockUnit: z.string().trim().max(20).optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  attributes: attributesSchema.nullable().optional(),
  translations: z.array(translationSchema).min(1).optional(),
});

// v2: dedicated stock-update endpoint (PATCH /products/:id/stock).
export const updateStockSchema = z
  .object({
    availability: availabilityEnum.optional(),
    stockQuantity: z.coerce.number().int().nonnegative().max(1_000_000).optional(),
    stockUnit: z.string().trim().max(20).optional(),
  })
  .refine((d) => d.availability !== undefined || d.stockQuantity !== undefined || d.stockUnit !== undefined, {
    message: 'Provide at least one stock field to update',
  });

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  locale: z.enum(['tj', 'ru', 'en']).optional(),
  q: z.string().trim().max(200).optional(),
  shopId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  brand: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED']).optional(),
  availability: availabilityEnum.optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'recently_updated']).optional(),
});

export const rejectSchema = z.object({ reason: z.string().trim().max(500).optional() });
export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
