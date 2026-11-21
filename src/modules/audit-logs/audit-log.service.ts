/**
 * Audit log service — records "who did what" for sensitive actions.
 *
 * Why a dedicated service? Many modules (auth, shops, products, admin) need to
 * write audit entries. Centralizing it keeps the shape consistent and lets us
 * change the storage later without touching every caller.
 *
 * IMPORTANT: recording an audit entry must NEVER break the real operation. If
 * the audit write fails we log a warning and continue — the user's action
 * (e.g. registration) still succeeds.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { getPagination, buildMeta } from '../../utils/pagination';

export interface RecordAuditInput {
  userId?: string | null; // the actor; null for anonymous/system actions
  action: string; // e.g. "SHOP_APPROVED", "USER_LOGIN"
  entityType: string; // e.g. "Shop", "User"
  entityId?: string | null;
  // Extra context. NEVER put passwords, tokens, or secrets here.
  metadata?: Prisma.InputJsonValue;
}

async function record(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    // Audit failures are non-fatal by design.
    logger.warn({ error, action: input.action }, 'Failed to write audit log');
  }
}

export interface ListAuditParams {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: string;
  userId?: string;
}

/** List audit entries (admin/super-admin only, newest first) with pagination. */
async function list(params: ListAuditParams) {
  const { skip, take, page, limit } = getPagination(params);

  const where: Prisma.AuditLogWhereInput = {
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.userId ? { userId: params.userId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export const auditLogService = { record, list };
