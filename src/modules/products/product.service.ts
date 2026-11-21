/**
 * Product service — business logic for products.
 *
 * Key rules (from the spec):
 *   - A seller can only manage products of a shop they are a member of.
 *   - New products start as PENDING and are invisible to the public.
 *   - Only ADMIN / SUPER_ADMIN approve or reject products.
 *   - Public listings return only APPROVED, non-deleted products.
 *   - Creating a product + its translations happens in ONE transaction.
 *   - Prices are Decimal (passed as strings) — never Float.
 */
import { Prisma } from '@prisma/client';
import type { Locale, UserRole, ProductStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { getPagination, buildMeta } from '../../utils/pagination';
import { resolveTranslations } from '../../utils/localization';
import { shopMemberService } from '../shop-members/shop-member.service';
import { auditLogService } from '../audit-logs/audit-log.service';
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from './product.validation';

type ProductFull = Prisma.ProductGetPayload<{
  include: { translations: true; images: true };
}>;

function present(product: ProductFull, locale: Locale) {
  return {
    id: product.id,
    shopId: product.shopId,
    categoryId: product.categoryId,
    // Decimal -> fixed 2-decimal string so money always shows e.g. "45.50".
    price: product.price.toFixed(2),
    currency: product.currency,
    status: product.status,
    availability: product.availability,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    images: product.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({ id: img.id, imageUrl: img.imageUrl, altText: img.altText, sortOrder: img.sortOrder })),
    ...resolveTranslations(product.translations, locale),
  };
}

interface ListOptions extends ListProductsQuery {
  publicOnly?: boolean;
  memberUserId?: string;
}

async function list(options: ListOptions) {
  const locale: Locale = options.locale ?? 'tj';
  const { skip, take, page, limit } = getPagination(options);

  // Build the price filter only if given.
  const priceFilter: Prisma.DecimalFilter = {};
  if (options.minPrice !== undefined) priceFilter.gte = options.minPrice;
  if (options.maxPrice !== undefined) priceFilter.lte = options.maxPrice;

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(options.publicOnly
      ? { status: 'APPROVED', shop: { status: 'APPROVED', deletedAt: null } }
      : options.status
        ? { status: options.status }
        : {}),
    ...(options.shopId ? { shopId: options.shopId } : {}),
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.availability ? { availability: options.availability } : {}),
    ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
    ...(options.memberUserId ? { shop: { members: { some: { userId: options.memberUserId } } } } : {}),
    ...(options.q
      ? { translations: { some: { name: { contains: options.q, mode: 'insensitive' } } } }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    options.sort === 'oldest'
      ? { createdAt: 'asc' }
      : options.sort === 'price_asc'
        ? { price: 'asc' }
        : options.sort === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, include: { translations: true, images: true }, orderBy, skip, take }),
    prisma.product.count({ where }),
  ]);

  return { items: rows.map((p) => present(p, locale)), meta: buildMeta(total, page, limit) };
}

async function getById(id: string, locale: Locale, viewer?: { id: string; role: UserRole }) {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: { translations: true, images: true },
  });
  if (!product) throw ApiError.notFound('Product');

  // Non-approved products are visible only to shop members or admins.
  if (product.status !== 'APPROVED') {
    if (!viewer) throw ApiError.notFound('Product');
    await shopMemberService.assertShopAccess(viewer.id, viewer.role, product.shopId);
  }
  return present(product, locale);
}

async function create(input: CreateProductInput, actor: { id: string; role: UserRole }) {
  // Ownership: the actor must be a member of the target shop (or an admin).
  await shopMemberService.assertShopAccess(actor.id, actor.role, input.shopId);

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw ApiError.badRequest('Category does not exist');
  }

  const product = await prisma.$transaction(async (tx) => {
    return tx.product.create({
      data: {
        shopId: input.shopId,
        categoryId: input.categoryId ?? null,
        // Convert to string so the Decimal column stores an exact value.
        price: new Prisma.Decimal(input.price.toFixed(2)),
        currency: input.currency ?? 'TJS',
        availability: input.availability ?? 'IN_STOCK',
        status: 'PENDING',
        translations: {
          create: input.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            description: t.description ?? null,
          })),
        },
      },
      include: { translations: true, images: true },
    });
  });

  await auditLogService.record({
    userId: actor.id,
    action: 'PRODUCT_CREATED',
    entityType: 'Product',
    entityId: product.id,
    metadata: { shopId: input.shopId },
  });

  return present(product, 'tj');
}

async function update(id: string, input: UpdateProductInput, actor: { id: string; role: UserRole }) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Product');

  await shopMemberService.assertShopAccess(actor.id, actor.role, existing.shopId);

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price.toFixed(2)) } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.availability ? { availability: input.availability } : {}),
      },
    });

    if (input.translations) {
      for (const t of input.translations) {
        await tx.productTranslation.upsert({
          where: { productId_locale: { productId: id, locale: t.locale } },
          create: { productId: id, locale: t.locale, name: t.name, description: t.description ?? null },
          update: { name: t.name, description: t.description ?? null },
        });
      }
    }

    return tx.product.findUniqueOrThrow({ where: { id }, include: { translations: true, images: true } });
  });

  await auditLogService.record({
    userId: actor.id,
    action: 'PRODUCT_UPDATED',
    entityType: 'Product',
    entityId: id,
  });

  return present(product, 'tj');
}

// Admin-only approve / reject.
async function changeStatus(id: string, status: ProductStatus, actor: { id: string }, reason?: string) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Product');

  const product = await prisma.product.update({
    where: { id },
    data: { status },
    include: { translations: true, images: true },
  });

  await auditLogService.record({
    userId: actor.id,
    action: `PRODUCT_${status}`,
    entityType: 'Product',
    entityId: id,
    metadata: reason ? { reason } : undefined,
  });

  return present(product, 'tj');
}

// Sellers "delete" -> soft delete (sets deletedAt). The row stays for history.
async function softDelete(id: string, actor: { id: string; role: UserRole }) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Product');

  await shopMemberService.assertShopAccess(actor.id, actor.role, existing.shopId);

  await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });

  await auditLogService.record({
    userId: actor.id,
    action: 'PRODUCT_DELETED',
    entityType: 'Product',
    entityId: id,
  });
}

export const productService = { list, getById, create, update, changeStatus, softDelete };
