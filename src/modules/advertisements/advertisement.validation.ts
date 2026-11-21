/**
 * Zod schemas for advertisements.
 */
import { z } from 'zod';

export const createAdvertisementSchema = z
  .object({
    shopId: z.string().uuid('A valid shopId is required'),
    title: z.string().trim().min(1).max(200),
    imageUrl: z.string().url().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  });

export const updateAdvertisementSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  imageUrl: z.string().url().nullable().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const listAdvertisementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  shopId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'PAUSED', 'ENDED', 'REJECTED']).optional(),
});

// Admin/owner lifecycle actions map to these target statuses.
export const statusActionSchema = z.object({
  action: z.enum(['submit', 'approve', 'reject', 'activate', 'pause', 'end']),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateAdvertisementInput = z.infer<typeof createAdvertisementSchema>;
export type UpdateAdvertisementInput = z.infer<typeof updateAdvertisementSchema>;
