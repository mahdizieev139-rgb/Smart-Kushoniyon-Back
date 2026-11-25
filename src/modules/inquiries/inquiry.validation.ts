/**
 * Zod schemas for the customer <-> seller inquiry system.
 */
import { z } from 'zod';

export const createInquirySchema = z.object({
  shopId: z.string().uuid('A valid shopId is required'),
  productId: z.string().uuid().optional(),
  subject: z.string().trim().max(200).optional(),
  // The first message of the thread.
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

export const addMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

export const listInquiriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
  shopId: z.string().uuid().optional(),
  // "customer" = inquiries I opened; "seller" = inquiries to my shops.
  role: z.enum(['customer', 'seller']).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type ListInquiriesQuery = z.infer<typeof listInquiriesQuerySchema>;
