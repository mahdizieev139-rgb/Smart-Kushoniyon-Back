/**
 * Shop service — business logic for shops.
 *
 * Key rules (from the spec):
 *   - A seller-created shop starts as PENDING and is invisible to the public.
 *   - Only ADMIN / SUPER_ADMIN can approve, reject, or suspend a shop.
 *   - Public users only ever see APPROVED, non-deleted shops.
 *   - The creator automatically becomes the shop's OWNER (shop member).
 *   - Deletion is SOFT (sets deletedAt) so related data is preserved.
 */
import type { Prisma, Locale, UserRole, ShopStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { slugifyUnique } from '../../utils/slug';
import { getPagination, buildMeta } from '../../utils/pagination';
import { resolveTranslations } from '../../utils/localization';
import { shopMemberService } from '../shop-members/shop-member.service';
import { auditLogService } from '../audit-logs/audit-log.service';
import type { CreateShopInput, UpdateShopInput, ListShopsQuery } from './shop.validation';

type ShopWithTranslations = Prisma.ShopGetPayload<{ include: { translations: true } }>;

function present(shop: ShopWithTranslations, locale: Locale) {
  return {
    id: shop.id,
    slug: shop.slug,
    phone: shop.phone,
    status: shop.status,
    sectionId: shop.sectionId,
    createdAt: shop.createdAt,
    updatedAt: shop.updatedAt,
    ...resolveTranslations(shop.translations, locale),
  };
}

interface ListOptions extends ListShopsQuery {
  // When true, only APPROVED non-deleted shops are returned (public view).
  publicOnly?: boolean;
  // Restrict to shops the given user is a member of (seller "my shops" view).
  memberUserId?: string;
}

async function list(options: ListOptions) {
  const locale: Locale = options.locale ?? 'tj';
  const { skip, take, page, limit } = getPagination(options);

  const where: Prisma.ShopWhereInput = {
    deletedAt: null,
    ...(options.publicOnly ? { status: 'APPROVED' } : options.status ? { status: options.status } : {}),
    ...(options.sectionId ? { sectionId: options.sectionId } : {}),
    // Filter by category = shops that have at least one product in it.
    ...(options.categoryId ? { products: { some: { categoryId: options.categoryId } } } : {}),
    ...(options.memberUserId ? { members: { some: { userId: options.memberUserId } } } : {}),
    // Text search across any translation name.
    ...(options.q
      ? { translations: { some: { name: { contains: options.q, mode: 'insensitive' } } } }
      : {}),
  };

  const orderBy: Prisma.ShopOrderByWithRelationInput =
    options.sort === 'oldest'
      ? { createdAt: 'asc' }
      : options.sort === 'name'
        ? { slug: 'asc' }
        : { createdAt: 'desc' };

  const [rows, total] = await Promise.all([
    prisma.shop.findMany({ where, include: { translations: true }, orderBy, skip, take }),
    prisma.shop.count({ where }),
  ]);

  return { items: rows.map((s) => present(s, locale)), meta: buildMeta(total, page, limit) };
}

async function getById(id: string, locale: Locale, viewer?: { id: string; role: UserRole }) {
  const shop = await prisma.shop.findFirst({
    where: { id, deletedAt: null },
    include: { translations: true },
  });
  if (!shop) throw ApiError.notFound('Shop');

  // A non-approved shop is only visible to its members or an admin.
  if (shop.status !== 'APPROVED') {
    await ensureCanView(shop, viewer);
  }
  return present(shop, locale);
}

async function getBySlug(slug: string, locale: Locale, viewer?: { id: string; role: UserRole }) {
  const shop = await prisma.shop.findFirst({
    where: { slug, deletedAt: null },
    include: { translations: true },
  });
  if (!shop) throw ApiError.notFound('Shop');
  if (shop.status !== 'APPROVED') {
    await ensureCanView(shop, viewer);
  }
  return present(shop, locale);
}

// Allow viewing a non-approved shop only for admins or shop members.
async function ensureCanView(shop: { id: string }, viewer?: { id: string; role: UserRole }) {
  if (!viewer) throw ApiError.notFound('Shop');
  await shopMemberService.assertShopAccess(viewer.id, viewer.role, shop.id);
}

async function create(input: CreateShopInput, owner: { id: string }) {
  const slug = slugifyUnique(input.slug ?? input.translations[0].name);

  const shop = await prisma.$transaction(async (tx) => {
    const created = await tx.shop.create({
      data: {
        slug,
        phone: input.phone ?? null,
        sectionId: input.sectionId ?? null,
        status: 'PENDING', // sellers always start pending
        translations: {
          create: input.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            description: t.description ?? null,
          })),
        },
        // The creator becomes the OWNER automatically.
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
      include: { translations: true },
    });
    return created;
  });

  await auditLogService.record({
    userId: owner.id,
    action: 'SHOP_CREATED',
    entityType: 'Shop',
    entityId: shop.id,
  });

  return present(shop, 'tj');
}

async function update(id: string, input: UpdateShopInput, actor: { id: string; role: UserRole }) {
  const existing = await prisma.shop.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Shop');

  // Ownership check: only a shop member or an admin may edit.
  await shopMemberService.assertShopAccess(actor.id, actor.role, id);

  const shop = await prisma.$transaction(async (tx) => {
    await tx.shop.update({
      where: { id },
      data: {
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.sectionId !== undefined ? { sectionId: input.sectionId } : {}),
      },
    });

    if (input.translations) {
      for (const t of input.translations) {
        await tx.shopTranslation.upsert({
          where: { shopId_locale: { shopId: id, locale: t.locale } },
          create: { shopId: id, locale: t.locale, name: t.name, description: t.description ?? null },
          update: { name: t.name, description: t.description ?? null },
        });
      }
    }

    return tx.shop.findUniqueOrThrow({ where: { id }, include: { translations: true } });
  });

  return present(shop, 'tj');
}

// Admin-only status change (approve / reject / suspend). Centralized so audit
// logging and validation live in one place.
async function changeStatus(
  id: string,
  status: ShopStatus,
  actor: { id: string },
  reason?: string,
) {
  const existing = await prisma.shop.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Shop');

  const shop = await prisma.shop.update({
    where: { id },
    data: { status },
    include: { translations: true },
  });

  await auditLogService.record({
    userId: actor.id,
    action: `SHOP_${status}`,
    entityType: 'Shop',
    entityId: id,
    metadata: reason ? { reason } : undefined,
  });

  return present(shop, 'tj');
}

async function softDelete(id: string, actor: { id: string; role: UserRole }) {
  const existing = await prisma.shop.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Shop');

  await shopMemberService.assertShopAccess(actor.id, actor.role, id);

  await prisma.shop.update({ where: { id }, data: { deletedAt: new Date() } });

  await auditLogService.record({
    userId: actor.id,
    action: 'SHOP_DELETED',
    entityType: 'Shop',
    entityId: id,
  });
}

export const shopService = {
  list,
  getById,
  getBySlug,
  create,
  update,
  changeStatus,
  softDelete,
};
