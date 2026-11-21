/**
 * Shop member service.
 *
 * A shop can have several members (OWNER / MANAGER / STAFF). A single user may
 * belong to multiple shops. This service answers the central authorization
 * question used all over the app:
 *
 *   "Is this user allowed to act on this shop?"
 *
 * The `assertShopAccess` helper is the ownership guard. We call it inside
 * services (not in route middleware) because only the service layer knows which
 * shop a given product/advertisement belongs to.
 *
 * Admins and super admins bypass membership — they manage every shop.
 */
import type { UserRole, ShopMemberRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';

function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

async function isMember(userId: string, shopId: string): Promise<boolean> {
  const membership = await prisma.shopMember.findUnique({
    where: { userId_shopId: { userId, shopId } },
    select: { id: true },
  });
  return membership !== null;
}

/**
 * Throws 403 unless the user is an admin OR a member of the shop.
 * Returns nothing; call it for its side effect (guard clause).
 */
async function assertShopAccess(userId: string, role: UserRole, shopId: string): Promise<void> {
  if (isAdmin(role)) return;
  const allowed = await isMember(userId, shopId);
  if (!allowed) {
    throw ApiError.forbidden('You do not have access to this shop');
  }
}

async function listMembers(shopId: string) {
  return prisma.shopMember.findMany({
    where: { shopId },
    include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

async function addMember(shopId: string, userId: string, memberRole: ShopMemberRole) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.badRequest('User does not exist');

  const existing = await prisma.shopMember.findUnique({
    where: { userId_shopId: { userId, shopId } },
  });
  if (existing) throw ApiError.conflict('User is already a member of this shop');

  return prisma.shopMember.create({ data: { shopId, userId, role: memberRole } });
}

async function removeMember(shopId: string, memberId: string) {
  const member = await prisma.shopMember.findFirst({ where: { id: memberId, shopId } });
  if (!member) throw ApiError.notFound('Shop member');

  // A shop must always keep at least one OWNER.
  if (member.role === 'OWNER') {
    const ownerCount = await prisma.shopMember.count({ where: { shopId, role: 'OWNER' } });
    if (ownerCount <= 1) {
      throw ApiError.badRequest('Cannot remove the last owner of a shop');
    }
  }

  await prisma.shopMember.delete({ where: { id: member.id } });
}

export const shopMemberService = {
  isAdmin,
  isMember,
  assertShopAccess,
  listMembers,
  addMember,
  removeMember,
};
