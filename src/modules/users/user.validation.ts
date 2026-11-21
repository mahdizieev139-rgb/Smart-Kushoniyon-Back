/**
 * Zod schemas for user management (admin / super-admin).
 */
import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  role: z.enum(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  q: z.string().trim().max(150).optional(),
});

// ADMIN can change a user's status; only SUPER_ADMIN can change the role
// (enforced in the route layer).
export const updateUserSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  role: z.enum(['CUSTOMER', 'SELLER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  name: z.string().trim().min(2).max(120).optional(),
});

// SUPER_ADMIN creates admin accounts (never via public register).
export const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'SUPER_ADMIN']).optional().default('ADMIN'),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
