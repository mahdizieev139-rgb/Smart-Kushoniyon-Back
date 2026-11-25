/**
 * Price comparison service.
 *
 * Given a product, find EQUIVALENT products from OTHER shops and compare prices.
 *
 * How we decide two products are "equivalent" (we deliberately do NOT rely on
 * similar names, which would produce false matches):
 *   - same category is the baseline candidate filter;
 *   - if the source has a brand, same-brand products are also considered;
 *   - each candidate gets a match score from: same brand, same unit, and the
 *     number of overlapping attribute key/values.
 * We return the score + the reasons (`matchedOn`) so the frontend can be honest
 * about how confident the match is.
 *
 * Only PUBLIC data is returned: APPROVED products from APPROVED, non-deleted
 * shops. Each result includes the shop and its market location, availability,
 * and the last price-update date.
 */
import type { Prisma, Locale } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { resolveTranslations } from '../../utils/localization';

type CandidateProduct = Prisma.ProductGetPayload<{
  include: {
    translations: true;
    images: true;
    shop: { include: { translations: true; section: { include: { translations: true; gate: { include: { translations: true } } } } } };
  };
}>;

const CANDIDATE_INCLUDE = {
  translations: true,
  images: true,
  shop: {
    include: {
      translations: true,
      section: { include: { translations: true, gate: { include: { translations: true } } } },
    },
  },
} satisfies Prisma.ProductInclude;

// Count how many attribute key/value pairs two products share.
function sharedAttributeCount(a: unknown, b: unknown): number {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return 0;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  let count = 0;
  for (const key of Object.keys(aObj)) {
    if (key in bObj && String(aObj[key]).toLowerCase() === String(bObj[key]).toLowerCase()) count += 1;
  }
  return count;
}

function presentProduct(product: CandidateProduct, locale: Locale, lastPriceUpdate: Date | null) {
  const shop = product.shop;
  const section = shop.section;
  return {
    id: product.id,
    price: product.price.toFixed(2),
    currency: product.currency,
    availability: product.availability,
    brand: product.brand,
    stockUnit: product.stockUnit,
    lastPriceUpdate: lastPriceUpdate ?? product.updatedAt,
    imageUrl: product.images.sort((x, y) => x.sortOrder - y.sortOrder)[0]?.imageUrl ?? null,
    ...resolveTranslations(product.translations, locale),
    shop: {
      id: shop.id,
      slug: shop.slug,
      shopNumber: shop.shopNumber,
      name: resolveTranslations(shop.translations, locale).name,
      location: section
        ? {
            sectionId: section.id,
            sectionName: resolveTranslations(section.translations, locale).name,
            rowNumber: section.rowNumber,
            gateId: section.gate.id,
            gateName: resolveTranslations(section.gate.translations, locale).name,
          }
        : null,
    },
  };
}

interface CompareOptions {
  locale?: Locale;
  sort?: 'price_asc' | 'price_desc';
  limit?: number;
}

async function compare(productId: string, options: CompareOptions) {
  const locale: Locale = options.locale ?? 'tj';
  const limit = Math.min(options.limit ?? 20, 50);

  // Source must be a public, approved product in an approved shop.
  const source = await prisma.product.findFirst({
    where: { id: productId, status: 'APPROVED', deletedAt: null, shop: { status: 'APPROVED', deletedAt: null } },
    include: CANDIDATE_INCLUDE,
  });
  if (!source) throw ApiError.notFound('Product');

  // Candidate filter: other approved products in active shops that share the
  // category OR the brand with the source.
  const orConditions: Prisma.ProductWhereInput[] = [];
  if (source.categoryId) orConditions.push({ categoryId: source.categoryId });
  if (source.brand) orConditions.push({ brand: { equals: source.brand, mode: 'insensitive' } });

  // Nothing to match on → return the source with no comparisons (honest result).
  if (orConditions.length === 0) {
    const latest = await latestPriceDate([source.id]);
    return { source: presentProduct(source, locale, latest.get(source.id) ?? null), comparisons: [], count: 0 };
  }

  const candidates = await prisma.product.findMany({
    where: {
      // Equivalent products from OTHER shops (price comparison across sellers).
      shopId: { not: source.shopId },
      status: 'APPROVED',
      deletedAt: null,
      shop: { status: 'APPROVED', deletedAt: null },
      OR: orConditions,
    },
    include: CANDIDATE_INCLUDE,
    take: 200, // cap the working set; we score + trim to `limit` below
  });

  // Fetch the latest price-change date for every involved product in ONE query.
  const lastDates = await latestPriceDate([source.id, ...candidates.map((c) => c.id)]);

  const sourcePrice = source.price;
  const scored = candidates
    .map((candidate) => {
      const matchedOn: string[] = [];
      let score = 0;
      if (source.categoryId && candidate.categoryId === source.categoryId) {
        score += 1;
        matchedOn.push('category');
      }
      if (source.brand && candidate.brand && source.brand.toLowerCase() === candidate.brand.toLowerCase()) {
        score += 2;
        matchedOn.push('brand');
      }
      if (source.stockUnit && candidate.stockUnit && source.stockUnit.toLowerCase() === candidate.stockUnit.toLowerCase()) {
        score += 1;
        matchedOn.push('unit');
      }
      const attrShared = sharedAttributeCount(source.attributes, candidate.attributes);
      if (attrShared > 0) {
        score += attrShared;
        matchedOn.push(`${attrShared} attribute(s)`);
      }

      return {
        ...presentProduct(candidate, locale, lastDates.get(candidate.id) ?? null),
        matchScore: score,
        matchedOn,
        priceDiff: candidate.price.minus(sourcePrice).toFixed(2),
      };
    })
    // Sort by price (as requested); default ascending.
    .sort((a, b) =>
      options.sort === 'price_desc'
        ? Number(b.price) - Number(a.price)
        : Number(a.price) - Number(b.price),
    )
    .slice(0, limit);

  return {
    source: presentProduct(source, locale, lastDates.get(source.id) ?? null),
    comparisons: scored,
    count: scored.length,
  };
}

// Returns a map of productId -> latest price-change date (or undefined).
async function latestPriceDate(productIds: string[]): Promise<Map<string, Date>> {
  const rows = await prisma.productPriceHistory.findMany({
    where: { productId: { in: productIds } },
    orderBy: { createdAt: 'desc' },
    distinct: ['productId'],
    select: { productId: true, createdAt: true },
  });
  return new Map(rows.map((r) => [r.productId, r.createdAt]));
}

export const priceComparisonService = { compare };
