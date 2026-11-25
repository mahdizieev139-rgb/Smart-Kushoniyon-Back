/**
 * Product price history service.
 *
 * `record` writes one row whenever a product's price meaningfully changes. It
 * accepts a transaction client so the history row is written in the SAME
 * transaction as the price update (all-or-nothing).
 *
 * `list` returns a product's price history, newest first, for the public
 * price-history endpoint and the comparison feature.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { getPagination, buildMeta } from '../../utils/pagination';

// Accept either the normal client or a transaction client.
type Db = Prisma.TransactionClient | typeof prisma;

interface RecordInput {
  productId: string;
  oldPrice: Prisma.Decimal | null;
  newPrice: Prisma.Decimal;
  currency: string;
  changedByUserId?: string | null;
}

async function record(db: Db, input: RecordInput) {
  return db.productPriceHistory.create({
    data: {
      productId: input.productId,
      oldPrice: input.oldPrice,
      newPrice: input.newPrice,
      currency: input.currency,
      changedByUserId: input.changedByUserId ?? null,
    },
  });
}

async function list(productId: string, query: { page?: number; limit?: number }) {
  // The product must exist and be visible (not hard-deleted).
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw ApiError.notFound('Product');

  const { skip, take, page, limit } = getPagination(query);
  const [rows, total] = await Promise.all([
    prisma.productPriceHistory.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.productPriceHistory.count({ where: { productId } }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    oldPrice: row.oldPrice ? row.oldPrice.toFixed(2) : null,
    newPrice: row.newPrice.toFixed(2),
    currency: row.currency,
    changedAt: row.createdAt,
  }));

  return { items, meta: buildMeta(total, page, limit) };
}

export const priceHistoryService = { record, list };
