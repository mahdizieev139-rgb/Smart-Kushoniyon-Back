/**
 * Zod schema for global search.
 */
import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(200),
  // Which record types to include. Default: all.
  type: z.enum(['all', 'shops', 'products', 'categories', 'sections']).optional().default('all'),
  locale: z.enum(['tj', 'ru', 'en']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  categoryId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
