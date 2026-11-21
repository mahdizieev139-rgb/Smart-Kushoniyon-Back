/**
 * Zod schemas for shop members.
 */
import { z } from 'zod';

export const addMemberSchema = z.object({
  userId: z.string().uuid('A valid userId is required'),
  role: z.enum(['OWNER', 'MANAGER', 'STAFF']).optional().default('STAFF'),
});

export const memberParamSchema = z.object({
  id: z.string().uuid('Invalid shop id'),
  memberId: z.string().uuid('Invalid member id'),
});
