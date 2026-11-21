/**
 * Search service — global, public search.
 *
 * Searches across shops, products, categories, and sections by their translated
 * names (case-insensitive "contains"). It ONLY returns publicly visible data:
 *   - shops:    APPROVED, not deleted
 *   - products: APPROVED, not deleted, in an APPROVED shop
 *   - sections: ACTIVE
 *
 * We use a shared "contains" match on the translations table. For large data
 * sets you can later swap this for PostgreSQL full-text or pg_trgm indexes —
 * the service boundary means callers won't change. (See docs/database.md.)
 */
import type { Prisma, Locale } from '@prisma/client';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/pagination';
import { resolveTranslations } from '../../utils/localization';
import type { SearchQuery } from './search.validation';

async function searchShops(query: SearchQuery, locale: Locale, skip: number, take: number) {
  const where: Prisma.ShopWhereInput = {
    status: 'APPROVED',
    deletedAt: null,
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    translations: { some: { name: { contains: query.q, mode: 'insensitive' } } },
  };
  const [rows, total] = await Promise.all([
    prisma.shop.findMany({ where, include: { translations: true }, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.shop.count({ where }),
  ]);
  return {
    total,
    items: rows.map((s) => ({ id: s.id, slug: s.slug, type: 'shop', ...resolveTranslations(s.translations, locale) })),
  };
}

async function searchProducts(query: SearchQuery, locale: Locale, skip: number, take: number) {
  const priceFilter: Prisma.DecimalFilter = {};
  if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
  if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;

  const where: Prisma.ProductWhereInput = {
    status: 'APPROVED',
    deletedAt: null,
    shop: { status: 'APPROVED', deletedAt: null },
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.shopId ? { shopId: query.shopId } : {}),
    ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
    translations: { some: { name: { contains: query.q, mode: 'insensitive' } } },
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    query.sort === 'price_asc' ? { price: 'asc' } : query.sort === 'price_desc' ? { price: 'desc' } : { createdAt: 'desc' };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, include: { translations: true, images: true }, skip, take, orderBy }),
    prisma.product.count({ where }),
  ]);
  return {
    total,
    items: rows.map((p) => ({
      id: p.id,
      shopId: p.shopId,
      type: 'product',
      price: p.price.toFixed(2),
      currency: p.currency,
      imageUrl: p.images.sort((a, b) => a.sortOrder - b.sortOrder)[0]?.imageUrl ?? null,
      ...resolveTranslations(p.translations, locale),
    })),
  };
}

async function searchCategories(query: SearchQuery, locale: Locale, skip: number, take: number) {
  const where: Prisma.CategoryWhereInput = {
    status: 'ACTIVE',
    translations: { some: { name: { contains: query.q, mode: 'insensitive' } } },
  };
  const [rows, total] = await Promise.all([
    prisma.category.findMany({ where, include: { translations: true }, skip, take }),
    prisma.category.count({ where }),
  ]);
  return {
    total,
    items: rows.map((c) => ({ id: c.id, slug: c.slug, type: 'category', ...resolveTranslations(c.translations, locale) })),
  };
}

async function searchSections(query: SearchQuery, locale: Locale, skip: number, take: number) {
  const where: Prisma.SectionWhereInput = {
    status: 'ACTIVE',
    translations: { some: { name: { contains: query.q, mode: 'insensitive' } } },
  };
  const [rows, total] = await Promise.all([
    prisma.section.findMany({ where, include: { translations: true }, skip, take }),
    prisma.section.count({ where }),
  ]);
  return {
    total,
    items: rows.map((s) => ({ id: s.id, code: s.code, type: 'section', ...resolveTranslations(s.translations, locale) })),
  };
}

async function search(query: SearchQuery) {
  const locale: Locale = query.locale ?? 'tj';
  const { skip, take, page, limit } = getPagination(query);
  const type = query.type ?? 'all';

  // Run only the requested searches (all by default) in parallel.
  const wantShops = type === 'all' || type === 'shops';
  const wantProducts = type === 'all' || type === 'products';
  const wantCategories = type === 'all' || type === 'categories';
  const wantSections = type === 'all' || type === 'sections';

  const [shops, products, categories, sections] = await Promise.all([
    wantShops ? searchShops(query, locale, skip, take) : Promise.resolve({ total: 0, items: [] }),
    wantProducts ? searchProducts(query, locale, skip, take) : Promise.resolve({ total: 0, items: [] }),
    wantCategories ? searchCategories(query, locale, skip, take) : Promise.resolve({ total: 0, items: [] }),
    wantSections ? searchSections(query, locale, skip, take) : Promise.resolve({ total: 0, items: [] }),
  ]);

  const total = shops.total + products.total + categories.total + sections.total;

  return {
    results: {
      shops: shops.items,
      products: products.items,
      categories: categories.items,
      sections: sections.items,
    },
    counts: {
      shops: shops.total,
      products: products.total,
      categories: categories.total,
      sections: sections.total,
    },
    meta: buildMeta(total, page, limit),
  };
}

export const searchService = { search };
