/**
 * Zod schemas for the auth endpoints.
 *
 * These describe EXACTLY what the request body may contain. The `validate`
 * middleware runs them before the controller, so controllers can trust the
 * input shape completely.
 */
import { z } from 'zod';

// A user can register/login with an email OR a phone (at least one required).
// We keep the rules in one place and reuse them.
const email = z.string().email('Invalid email address').toLowerCase().trim();
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits, optional leading +');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

// Customers and sellers may self-register. Admins are created by a SUPER_ADMIN,
// so the public register endpoint only allows these two roles.
export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(120).trim(),
    email: email.optional(),
    phone: phone.optional(),
    password,
    role: z.enum(['CUSTOMER', 'SELLER']).default('CUSTOMER'),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Provide an email or a phone number',
    path: ['email'],
  });

export const loginSchema = z
  .object({
    email: email.optional(),
    phone: phone.optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Provide an email or a phone number',
    path: ['email'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
