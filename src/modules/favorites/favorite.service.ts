/**
 * Favorites service.
 *
 * A customer can favorite products and shops. Every operation is scoped to the
 * authenticated user's id, so one customer can never see or change another
 * customer's favorites. The unique constraints in the schema prevent duplicates
 * at the database level; we also return friendly errors.
 */
import type { Locale } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { resolveTranslations } from '../../utils/localization';

// List the user's favorite products and shops (public-facing presentation).
async function list(userId: string, locale: Locale = 'tj') {
  const [products, shops] = await Promise.all([
    prisma.favoriteProduct.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: { translations: true, images: true } } },
    }),
    prisma.favoriteShop.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { shop: { include: { translations: true } } },
    }),
  ]);

  return {
    products: products.map((f) => ({
      favoritedAt: f.createdAt,
      id: f.product.id,
      price: f.product.price.toFixed(2),
      currency: f.product.currency,
      availability: f.product.availability,
      status: f.product.status,
      imageUrl: f.product.images.sort((a, b) => a.sortOrder - b.sortOrder)[0]?.imageUrl ?? null,
      ...resolveTranslations(f.product.translations, locale),
    })),
    shops: shops.map((f) => ({
      favoritedAt: f.createdAt,
      id: f.shop.id,
      slug: f.shop.slug,
      status: f.shop.status,
      ...resolveTranslations(f.shop.translations, locale),
    })),
  };
}

async function addProduct(userId: string, productId: string) {
  // The product must exist and not be deleted.
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw ApiError.notFound('Product');

  const existing = await prisma.favoriteProduct.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) return existing; // already favorited — idempotent success

  return prisma.favoriteProduct.create({ data: { userId, productId } });
}

async function removeProduct(userId: string, productId: string) {
  const result = await prisma.favoriteProduct.deleteMany({ where: { userId, productId } });
  if (result.count === 0) throw ApiError.notFound('Favorite');
}

async function addShop(userId: string, shopId: string) {
  const shop = await prisma.shop.findFirst({ where: { id: shopId, deletedAt: null }, select: { id: true } });
  if (!shop) throw ApiError.notFound('Shop');

  const existing = await prisma.favoriteShop.findUnique({
    where: { userId_shopId: { userId, shopId } },
  });
  if (existing) return existing;

  return prisma.favoriteShop.create({ data: { userId, shopId } });
}

async function removeShop(userId: string, shopId: string) {
  const result = await prisma.favoriteShop.deleteMany({ where: { userId, shopId } });
  if (result.count === 0) throw ApiError.notFound('Favorite');
}

export const favoriteService = { list, addProduct, removeProduct, addShop, removeShop };
