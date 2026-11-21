/**
 * Advertisement service.
 *
 * Lifecycle (status):
 *   DRAFT ──submit──▶ PENDING ──approve──▶ ACTIVE ⇄ PAUSED ──end──▶ ENDED
 *                              └──reject───▶ REJECTED
 *
 * Who can do what:
 *   - Shop members (or admins): create, update, submit, activate, pause, end.
 *   - Admins / super admins only: approve, reject (sponsored content review).
 *
 * Public users only see ACTIVE advertisements whose date window includes now.
 */
import type { Prisma, UserRole, AdvertisementStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { getPagination, buildMeta } from '../../utils/pagination';
import { shopMemberService } from '../shop-members/shop-member.service';
import { auditLogService } from '../audit-logs/audit-log.service';
import type { CreateAdvertisementInput, UpdateAdvertisementInput } from './advertisement.validation';

// Actions an owner may perform vs. actions reserved for admins.
const OWNER_ACTIONS: Record<string, AdvertisementStatus> = {
  submit: 'PENDING',
  activate: 'ACTIVE',
  pause: 'PAUSED',
  end: 'ENDED',
};
const ADMIN_ACTIONS: Record<string, AdvertisementStatus> = {
  approve: 'ACTIVE',
  reject: 'REJECTED',
};

interface ListParams {
  page?: number;
  limit?: number;
  shopId?: string;
  status?: AdvertisementStatus;
  publicOnly?: boolean;
  memberUserId?: string;
}

async function list(params: ListParams) {
  const { skip, take, page, limit } = getPagination(params);
  const now = new Date();

  const where: Prisma.AdvertisementWhereInput = {
    ...(params.publicOnly
      ? { status: 'ACTIVE', startDate: { lte: now }, endDate: { gte: now } }
      : params.status
        ? { status: params.status }
        : {}),
    ...(params.shopId ? { shopId: params.shopId } : {}),
    ...(params.memberUserId ? { shop: { members: { some: { userId: params.memberUserId } } } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.advertisement.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.advertisement.count({ where }),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
}

async function getById(id: string) {
  const ad = await prisma.advertisement.findUnique({ where: { id } });
  if (!ad) throw ApiError.notFound('Advertisement');
  return ad;
}

async function create(input: CreateAdvertisementInput, actor: { id: string; role: UserRole }) {
  await shopMemberService.assertShopAccess(actor.id, actor.role, input.shopId);

  const ad = await prisma.advertisement.create({
    data: {
      shopId: input.shopId,
      title: input.title,
      imageUrl: input.imageUrl ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'DRAFT',
    },
  });

  await auditLogService.record({
    userId: actor.id,
    action: 'AD_CREATED',
    entityType: 'Advertisement',
    entityId: ad.id,
  });
  return ad;
}

async function update(id: string, input: UpdateAdvertisementInput, actor: { id: string; role: UserRole }) {
  const existing = await prisma.advertisement.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Advertisement');
  await shopMemberService.assertShopAccess(actor.id, actor.role, existing.shopId);

  // If both dates end up set, make sure the window is still valid.
  const start = input.startDate ?? existing.startDate;
  const end = input.endDate ?? existing.endDate;
  if (end <= start) throw ApiError.badRequest('endDate must be after startDate');

  return prisma.advertisement.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.startDate ? { startDate: input.startDate } : {}),
      ...(input.endDate ? { endDate: input.endDate } : {}),
    },
  });
}

// One place for every status change, with the correct permission per action.
async function changeStatus(id: string, action: string, actor: { id: string; role: UserRole }) {
  const existing = await prisma.advertisement.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Advertisement');

  const isAdminAction = action in ADMIN_ACTIONS;
  if (isAdminAction) {
    if (!shopMemberService.isAdmin(actor.role)) {
      throw ApiError.forbidden('Only admins can approve or reject advertisements');
    }
  } else if (action in OWNER_ACTIONS) {
    await shopMemberService.assertShopAccess(actor.id, actor.role, existing.shopId);
  } else {
    throw ApiError.badRequest('Unknown advertisement action');
  }

  const nextStatus = isAdminAction ? ADMIN_ACTIONS[action] : OWNER_ACTIONS[action];

  const ad = await prisma.advertisement.update({ where: { id }, data: { status: nextStatus } });

  await auditLogService.record({
    userId: actor.id,
    action: `AD_${nextStatus}`,
    entityType: 'Advertisement',
    entityId: id,
  });
  return ad;
}

export const advertisementService = { list, getById, create, update, changeStatus };
