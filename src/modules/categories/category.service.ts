/**
 * Category service — business logic for categories.
 *
 * Categories form a tree (parent/child). Each category has translations.
 * Public users only see ACTIVE categories; admins can see/manage all.
 *
 * We use a transaction when creating/updating so the category and its
 * translations are written together (all-or-nothing).
 */
import type { Prisma, Locale } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { slugify } from '../../utils/slug';
import { getPagination, buildMeta } from '../../utils/pagination';
import { resolveTranslations } from '../../utils/localization';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.validation';

// Shape a category row (with translations) into the API response.
function present(
  category: {
    id: string;
    slug: string;
    parentId: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    translations: { locale: Locale; name: string; description: string | null }[];
  },
  locale: Locale,
) {
  return {
    id: category.id,
    slug: category.slug,
    parentId: category.parentId,
    status: category.status,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    ...resolveTranslations(category.translations, locale),
  };
}

interface ListParams {
  page?: number;
  limit?: number;
  locale?: Locale;
  parentId?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  tree?: boolean;
  // When true (public), force status = ACTIVE regardless of the filter.
  publicOnly?: boolean;
}

async function list(params: ListParams) {
  const locale = params.locale ?? 'tj';
  const where: Prisma.CategoryWhereInput = {
    ...(params.publicOnly ? { status: 'ACTIVE' } : params.status ? { status: params.status } : {}),
    ...(params.parentId ? { parentId: params.parentId } : {}),
  };

  const { skip, take, page, limit } = getPagination(params);

  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: { translations: true },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
    prisma.category.count({ where }),
  ]);

  return { items: rows.map((c) => present(c, locale)), meta: buildMeta(total, page, limit) };
}

async function getById(id: string, locale: Locale = 'tj') {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { translations: true, children: { include: { translations: true } } },
  });
  if (!category) throw ApiError.notFound('Category');

  return {
    ...present(category, locale),
    children: category.children.map((child) => present(child, locale)),
  };
}

async function create(input: CreateCategoryInput) {
  // If the parent is given, make sure it exists (clear error, not FK crash).
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw ApiError.badRequest('Parent category does not exist');
  }

  // Build the slug from the first translation name unless one is provided.
  const slug = input.slug ? slugify(input.slug) : slugify(input.translations[0].name);

  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.category.create({
      data: {
        slug,
        parentId: input.parentId ?? null,
        translations: {
          create: input.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
            description: t.description ?? null,
          })),
        },
      },
      include: { translations: true },
    });
    return created;
  });

  return present(category, 'tj');
}

async function update(id: string, input: UpdateCategoryInput) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Category');

  // Prevent setting a category as its own parent (simple cycle guard).
  if (input.parentId && input.parentId === id) {
    throw ApiError.badRequest('A category cannot be its own parent');
  }

  const category = await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id },
      data: {
        ...(input.slug ? { slug: slugify(input.slug) } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });

    // Upsert each provided translation (replace per locale).
    if (input.translations) {
      for (const t of input.translations) {
        await tx.categoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: id, locale: t.locale } },
          create: { categoryId: id, locale: t.locale, name: t.name, description: t.description ?? null },
          update: { name: t.name, description: t.description ?? null },
        });
      }
    }

    return tx.category.findUniqueOrThrow({ where: { id }, include: { translations: true } });
  });

  return present(category, 'tj');
}

// We ARCHIVE categories instead of hard-deleting, so existing products keep
// their reference. A real delete is blocked if products still use it.
async function remove(id: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) throw ApiError.notFound('Category');

  if (existing._count.products > 0 || existing._count.children > 0) {
    // Has dependents -> soft archive instead of deleting.
    await prisma.category.update({ where: { id }, data: { status: 'ARCHIVED' } });
    return { archived: true };
  }

  await prisma.category.delete({ where: { id } });
  return { archived: false };
}

export const categoryService = { list, getById, create, update, remove };
