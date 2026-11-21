/**
 * System settings service (SUPER_ADMIN).
 *
 * A simple key/value store backed by the SystemSetting table. Useful for
 * configurable values (e.g. subscription plans, feature flags) that admins
 * change at runtime without a code deploy.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { auditLogService } from '../audit-logs/audit-log.service';

async function list() {
  return prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
}

async function getByKey(key: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  if (!setting) throw ApiError.notFound('Setting');
  return setting;
}

async function upsert(key: string, value: unknown, actorId: string) {
  const setting = await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
  await auditLogService.record({
    userId: actorId,
    action: 'SETTING_UPDATED',
    entityType: 'SystemSetting',
    entityId: setting.id,
    metadata: { key },
  });
  return setting;
}

async function remove(key: string, actorId: string) {
  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  if (!existing) throw ApiError.notFound('Setting');
  await prisma.systemSetting.delete({ where: { key } });
  await auditLogService.record({
    userId: actorId,
    action: 'SETTING_DELETED',
    entityType: 'SystemSetting',
    entityId: existing.id,
    metadata: { key },
  });
}

export const settingService = { list, getByKey, upsert, remove };
