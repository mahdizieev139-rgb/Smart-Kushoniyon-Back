/**
 * User management service (admin / super-admin).
 *
 * Security notes:
 *   - We never return passwordHash (we select explicit safe fields).
 *   - Changing a user's ROLE is a sensitive action reserved for SUPER_ADMIN
 *     (enforced by the route). The service additionally guards role changes so
 *     only SUPER_ADMIN callers can set them, as a defense-in-depth measure.
 */
import type { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { hashPassword } from '../../utils/password';
import { getPagination, buildMeta } from '../../utils/pagination';
import { auditLogService } from '../audit-logs/audit-log.service';
import type { UpdateUserInput, CreateAdminInput } from './user.validation';

// The exact fields we are safe to expose (no passwordHash).
const safeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

interface ListParams {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: UserStatus;
  q?: string;
}

async function list(params: ListParams) {
  const { skip, take, page, limit } = getPagination(params);
  const where: Prisma.UserWhereInput = {
    ...(params.role ? { role: params.role } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { email: { contains: params.q, mode: 'insensitive' } },
            { phone: { contains: params.q } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: safeSelect, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
}

async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: safeSelect });
  if (!user) throw ApiError.notFound('User');
  return user;
}

// `actorRole` lets us block non-super-admins from changing roles here too.
async function update(id: string, input: UpdateUserInput, actor: { id: string; role: UserRole }) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('User');

  // Only SUPER_ADMIN may change a user's role.
  if (input.role && actor.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only a SUPER_ADMIN can change user roles');
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.role ? { role: input.role } : {}),
    },
    select: safeSelect,
  });

  await auditLogService.record({
    userId: actor.id,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: id,
    metadata: { changedStatus: input.status, changedRole: input.role },
  });
  return user;
}

// SUPER_ADMIN creates admin/super-admin accounts.
async function createAdmin(input: CreateAdminInput, actorId: string) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: input.role },
    select: safeSelect,
  });

  await auditLogService.record({
    userId: actorId,
    action: 'ADMIN_CREATED',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: user.role },
  });
  return user;
}

export const userService = { list, getById, update, createAdmin };
