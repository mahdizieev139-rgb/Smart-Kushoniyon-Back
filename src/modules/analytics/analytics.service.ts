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
import { prisma } from '../../config/database';

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

export const analyticsService = { getAdminOverview, getSellerOverview };
