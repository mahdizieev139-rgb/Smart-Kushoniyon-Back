/**
 * Zod schemas for subscriptions (B2B monthly SaaS billing).
 */
import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  shopId: z.string().uuid('A valid shopId is required'),
  planName: z.string().trim().min(1).max(100),
  amount: z.coerce.number().positive().max(1_000_000),
  currency: z.string().trim().length(3).toUpperCase().optional().default('TJS'),
  billingPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional().default('MONTHLY'),
  startsAt: z.coerce.date().optional(),
  // If omitted, the service computes expiry from startsAt + billingPeriod.
  expiresAt: z.coerce.date().optional(),
});

export const updateSubscriptionSchema = z.object({
  planName: z.string().trim().min(1).max(100).optional(),
  amount: z.coerce.number().positive().max(1_000_000).optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  expiresAt: z.coerce.date().optional(),
});

export const listSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  shopId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
});

// Manual invoice/payment status tracking (no payment gateway yet).
export const recordInvoiceSchema = z.object({
  status: z.enum(['UNPAID', 'PAID', 'REFUNDED', 'VOID']),
  note: z.string().trim().max(500).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
