/**
 * Analytics service.
 *
 * Two audiences:
 *   - Admin:  market-wide counts (shops, products, sellers, active ads).
 *   - Seller: statistics for ONLY the shops the seller is a member of.
 *
 * Seller analytics must never leak other sellers' data — every query is scoped
 * by the seller's shop memberships.
 */
import type { Locale } from '@prisma/client';
import { prisma } from '../../config/database';
import { resolveTranslations } from '../../utils/localization';

// The shop ids a user is a member of (used to scope all seller analytics).
async function sellerShopIds(userId: string): Promise<string[]> {
  const memberships = await prisma.shopMember.findMany({ where: { userId }, select: { shopId: true } });
  return memberships.map((m) => m.shopId);
}

async function getAdminOverview() {
  const now = new Date();

  // Run all count queries in parallel for speed.
  const [
    totalShops,
    approvedShops,
    pendingShops,
    totalProducts,
    approvedProducts,
    pendingProducts,
    totalSellers,
    activeAds,
    activeSubscriptions,
  ] = await Promise.all([
    prisma.shop.count({ where: { deletedAt: null } }),
    prisma.shop.count({ where: { deletedAt: null, status: 'APPROVED' } }),
    prisma.shop.count({ where: { deletedAt: null, status: 'PENDING' } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null, status: 'APPROVED' } }),
    prisma.product.count({ where: { deletedAt: null, status: 'PENDING' } }),
    prisma.user.count({ where: { role: 'SELLER' } }),
    prisma.advertisement.count({ where: { status: 'ACTIVE', startDate: { lte: now }, endDate: { gte: now } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
  ]);

  return {
    shops: { total: totalShops, approved: approvedShops, pending: pendingShops },
    products: { total: totalProducts, approved: approvedProducts, pending: pendingProducts },
    sellers: { total: totalSellers },
    advertisements: { active: activeAds },
    subscriptions: { active: activeSubscriptions },
  };
}

// Per-shop product statistics for the shops a seller manages.
async function getSellerOverview(userId: string) {
  const memberships = await prisma.shopMember.findMany({
    where: { userId },
    select: { shopId: true },
  });
  const shopIds = memberships.map((m) => m.shopId);

  if (shopIds.length === 0) {
    return { shops: [], totals: { shops: 0, products: 0, approvedProducts: 0, pendingProducts: 0 } };
  }

  const shops = await prisma.shop.findMany({
    where: { id: { in: shopIds }, deletedAt: null },
    include: { translations: true },
  });

  // For each shop, count products by status (scoped to that shop only).
  const perShop = await Promise.all(
    shops.map(async (shop) => {
      const [total, approved, pending] = await Promise.all([
        prisma.product.count({ where: { shopId: shop.id, deletedAt: null } }),
        prisma.product.count({ where: { shopId: shop.id, deletedAt: null, status: 'APPROVED' } }),
        prisma.product.count({ where: { shopId: shop.id, deletedAt: null, status: 'PENDING' } }),
      ]);
      return {
        shopId: shop.id,
        slug: shop.slug,
        status: shop.status,
        products: { total, approved, pending },
      };
    }),
  );

  const totals = perShop.reduce(
    (acc, s) => ({
      shops: acc.shops + 1,
      products: acc.products + s.products.total,
      approvedProducts: acc.approvedProducts + s.products.approved,
      pendingProducts: acc.pendingProducts + s.products.pending,
    }),
    { shops: 0, products: 0, approvedProducts: 0, pendingProducts: 0 },
  );

  return { shops: perShop, totals };
}

// v2: per-shop view counts for the seller's shops.
async function getSellerShopAnalytics(userId: string, locale: Locale = 'tj') {
  const shopIds = await sellerShopIds(userId);
  if (shopIds.length === 0) return { shops: [], totalViews: 0 };

  const [shops, viewCounts] = await Promise.all([
    prisma.shop.findMany({ where: { id: { in: shopIds }, deletedAt: null }, include: { translations: true } }),
    prisma.shopView.groupBy({ by: ['shopId'], where: { shopId: { in: shopIds } }, _count: { _all: true } }),
  ]);
  const viewMap = new Map(viewCounts.map((v) => [v.shopId, v._count._all]));

  const result = shops.map((shop) => ({
    shopId: shop.id,
    slug: shop.slug,
    status: shop.status,
    name: resolveTranslations(shop.translations, locale).name,
    views: viewMap.get(shop.id) ?? 0,
  }));
  return { shops: result, totalViews: result.reduce((a, s) => a + s.views, 0) };
}

// v2: per-product views, most viewed, recently updated, and inventory snapshot.
async function getSellerProductAnalytics(userId: string, locale: Locale = 'tj') {
  const shopIds = await sellerShopIds(userId);
  if (shopIds.length === 0)
    return { totalProductViews: 0, mostViewed: [], recentlyUpdated: [], inventory: [] };

  const products = await prisma.product.findMany({
    where: { shopId: { in: shopIds }, deletedAt: null },
    include: { translations: true },
  });
  const productIds = products.map((p) => p.id);

  const viewCounts = productIds.length
    ? await prisma.productView.groupBy({ by: ['productId'], where: { productId: { in: productIds } }, _count: { _all: true } })
    : [];
  const viewMap = new Map(viewCounts.map((v) => [v.productId, v._count._all]));

  const enriched = products.map((p) => ({
    productId: p.id,
    shopId: p.shopId,
    name: resolveTranslations(p.translations, locale).name,
    status: p.status,
    availability: p.availability,
    stockQuantity: p.stockQuantity,
    stockUnit: p.stockUnit,
    lastStockUpdate: p.lastStockUpdate,
    price: p.price.toFixed(2),
    updatedAt: p.updatedAt,
    views: viewMap.get(p.id) ?? 0,
  }));

  const mostViewed = [...enriched].sort((a, b) => b.views - a.views).slice(0, 10);
  const recentlyUpdated = [...enriched]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);
  const inventory = enriched.map((p) => ({
    productId: p.productId,
    name: p.name,
    availability: p.availability,
    stockQuantity: p.stockQuantity,
    stockUnit: p.stockUnit,
    lastStockUpdate: p.lastStockUpdate,
  }));

  return {
    totalProductViews: enriched.reduce((a, p) => a + p.views, 0),
    mostViewed,
    recentlyUpdated,
    inventory,
  };
}

// v2: combined seller analytics overview (counts + views + highlights).
async function getSellerAnalyticsOverview(userId: string, locale: Locale = 'tj') {
  const [base, shopViews, productStats] = await Promise.all([
    getSellerOverview(userId),
    getSellerShopAnalytics(userId, locale),
    getSellerProductAnalytics(userId, locale),
  ]);
  return {
    totals: {
      ...base.totals,
      totalShopViews: shopViews.totalViews,
      totalProductViews: productStats.totalProductViews,
    },
    topProducts: productStats.mostViewed.slice(0, 5),
    recentlyUpdated: productStats.recentlyUpdated.slice(0, 5),
    shops: shopViews.shops,
  };
}

export const analyticsService = {
  getAdminOverview,
  getSellerOverview,
  getSellerShopAnalytics,
  getSellerProductAnalytics,
  getSellerAnalyticsOverview,
};
