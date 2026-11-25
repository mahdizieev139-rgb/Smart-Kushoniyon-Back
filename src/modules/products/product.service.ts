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
import type { Locale, UserRole, ProductStatus, ProductAvailability } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { getPagination, buildMeta } from '../../utils/pagination';
import { resolveTranslations } from '../../utils/localization';
import { shopMemberService } from '../shop-members/shop-member.service';
import { auditLogService } from '../audit-logs/audit-log.service';
import { priceHistoryService } from '../price-history/price-history.service';
import { notificationService } from '../notifications/notification.service';
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
  UpdateStockInput,
} from './product.validation';

// Availability values that count as "buyable" — used to detect a product
// coming back into stock (so we can notify customers who favorited it).
const AVAILABLE_STATES: ProductAvailability[] = ['IN_STOCK', 'LIMITED_STOCK'];

// Notify everyone who favorited this product. Never throws (best-effort).
async function notifyFavoriters(
  productId: string,
  type: 'PRICE_CHANGED' | 'PRODUCT_AVAILABLE',
  title: string,
  data: Record<string, unknown>,
) {
  const favorites = await prisma.favoriteProduct.findMany({
    where: { productId },
    select: { userId: true },
  });
  if (favorites.length === 0) return;
  await notificationService.createForManyUsers(
    favorites.map((f) => f.userId),
    {
      type,
      title,
      data: data as Prisma.InputJsonValue,
      dedupeKey: `${type}:${productId}:${String(data.newPrice ?? '')}`,
    },
  );
}

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
    // v2 inventory + comparison fields.
    stockQuantity: product.stockQuantity,
    stockUnit: product.stockUnit,
    lastStockUpdate: product.lastStockUpdate,
    brand: product.brand,
    attributes: product.attributes,
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
    ...(options.brand ? { brand: { equals: options.brand, mode: 'insensitive' } } : {}),
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
          : options.sort === 'recently_updated'
            ? { updatedAt: 'desc' }
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

  const price = new Prisma.Decimal(input.price.toFixed(2));
  const currency = input.currency ?? 'TJS';
  const hasStock = input.stockQuantity !== undefined;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        shopId: input.shopId,
        categoryId: input.categoryId ?? null,
        price,
        currency,
        availability: input.availability ?? 'IN_STOCK',
        stockQuantity: input.stockQuantity ?? null,
        stockUnit: input.stockUnit ?? null,
        lastStockUpdate: hasStock ? new Date() : null,
        brand: input.brand ?? null,
        attributes: input.attributes ?? Prisma.JsonNull,
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

    // Record the first price point (oldPrice = null) in the same transaction.
    await priceHistoryService.record(tx, {
      productId: created.id,
      oldPrice: null,
      newPrice: price,
      currency,
      changedByUserId: actor.id,
    });

    return created;
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

  // Figure out what is changing so we can log price history and notifications.
  const newPrice = input.price !== undefined ? new Prisma.Decimal(input.price.toFixed(2)) : undefined;
  const priceChanged = newPrice !== undefined && !newPrice.equals(existing.price);
  const newCurrency = input.currency ?? existing.currency;

  const availabilityChanged =
    input.availability !== undefined && input.availability !== existing.availability;
  const becameAvailable =
    availabilityChanged &&
    !AVAILABLE_STATES.includes(existing.availability) &&
    AVAILABLE_STATES.includes(input.availability as ProductAvailability);
  // Stock fields count as a stock update (refreshes lastStockUpdate).
  const stockTouched = input.stockQuantity !== undefined || input.stockUnit !== undefined;

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(newPrice !== undefined ? { price: newPrice } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.availability ? { availability: input.availability } : {}),
        ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
        ...(input.stockUnit !== undefined ? { stockUnit: input.stockUnit } : {}),
        ...(stockTouched ? { lastStockUpdate: new Date() } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.attributes !== undefined ? { attributes: input.attributes ?? Prisma.JsonNull } : {}),
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

    // Record the price change in the same transaction (only if it changed).
    if (priceChanged && newPrice) {
      await priceHistoryService.record(tx, {
        productId: id,
        oldPrice: existing.price,
        newPrice,
        currency: newCurrency,
        changedByUserId: actor.id,
      });
    }

    return tx.product.findUniqueOrThrow({ where: { id }, include: { translations: true, images: true } });
  });

  // Notifications run AFTER the transaction commits (best-effort, non-blocking).
  // Only for APPROVED products (public), so we don't notify about drafts.
  if (product.status === 'APPROVED') {
    if (priceChanged && newPrice) {
      await notifyFavoriters(id, 'PRICE_CHANGED', 'A favorite product changed price', {
        productId: id,
        oldPrice: existing.price.toFixed(2),
        newPrice: newPrice.toFixed(2),
        currency: newCurrency,
      });
    }
    if (becameAvailable) {
      await notifyFavoriters(id, 'PRODUCT_AVAILABLE', 'A favorite product is available again', {
        productId: id,
      });
    }
  }

  await auditLogService.record({
    userId: actor.id,
    action: 'PRODUCT_UPDATED',
    entityType: 'Product',
    entityId: id,
  });

  return present(product, 'tj');
}

// Dedicated stock update used by PATCH /products/:id/stock. Sellers update only
// their own products' stock. Returns the updated product.
async function updateStock(id: string, input: UpdateStockInput, actor: { id: string; role: UserRole }) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Product');
  await shopMemberService.assertShopAccess(actor.id, actor.role, existing.shopId);

  const becameAvailable =
    input.availability !== undefined &&
    !AVAILABLE_STATES.includes(existing.availability) &&
    AVAILABLE_STATES.includes(input.availability as ProductAvailability);

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.availability ? { availability: input.availability } : {}),
      ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
      ...(input.stockUnit !== undefined ? { stockUnit: input.stockUnit } : {}),
      lastStockUpdate: new Date(),
    },
    include: { translations: true, images: true },
  });

  if (product.status === 'APPROVED' && becameAvailable) {
    await notifyFavoriters(id, 'PRODUCT_AVAILABLE', 'A favorite product is available again', {
      productId: id,
    });
  }

  await auditLogService.record({
    userId: actor.id,
    action: 'PRODUCT_STOCK_UPDATED',
    entityType: 'Product',
    entityId: id,
    metadata: { availability: product.availability, stockQuantity: product.stockQuantity },
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

export const productService = { list, getById, create, update, updateStock, changeStatus, softDelete };
