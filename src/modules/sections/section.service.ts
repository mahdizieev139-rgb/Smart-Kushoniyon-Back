/**
 * Section service — areas/rows inside a gate where shops are located.
 *
 * Public users can read sections and the (approved) shops inside them, for the
 * market map. Only admins manage sections.
 */
import type { Prisma, Locale } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { resolveTranslations } from '../../utils/localization';
import type { CreateSectionInput, UpdateSectionInput } from './section.validation';

type SectionFull = Prisma.SectionGetPayload<{ include: { translations: true } }>;

function present(section: SectionFull, locale: Locale) {
  return {
    id: section.id,
    gateId: section.gateId,
    code: section.code,
    rowNumber: section.rowNumber,
    latitude: section.latitude ? Number(section.latitude) : null,
    longitude: section.longitude ? Number(section.longitude) : null,
    posX: section.posX ? Number(section.posX) : null,
    posY: section.posY ? Number(section.posY) : null,
    isDemo: section.isDemo,
    status: section.status,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt,
    ...resolveTranslations(section.translations, locale),
  };
}

async function list(params: {
  locale?: Locale;
  gateId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  publicOnly?: boolean;
}) {
  const locale: Locale = params.locale ?? 'tj';
  const where: Prisma.SectionWhereInput = {
    ...(params.publicOnly ? { status: 'ACTIVE' } : params.status ? { status: params.status } : {}),
    ...(params.gateId ? { gateId: params.gateId } : {}),
  };
  const sections = await prisma.section.findMany({
    where,
    include: { translations: true },
    orderBy: { code: 'asc' },
  });
  return sections.map((s) => present(s, locale));
}

async function getById(id: string, locale: Locale = 'tj') {
  const section = await prisma.section.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!section) throw ApiError.notFound('Section');
  return present(section, locale);
}

// Approved shops located in a given section (for the map "section drawer").
async function getShops(sectionId: string, locale: Locale = 'tj') {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) throw ApiError.notFound('Section');

  const shops = await prisma.shop.findMany({
    where: { sectionId, status: 'APPROVED', deletedAt: null },
    include: { translations: true },
    orderBy: { createdAt: 'desc' },
  });

  return shops.map((shop) => ({
    id: shop.id,
    slug: shop.slug,
    phone: shop.phone,
    status: shop.status,
    shopNumber: shop.shopNumber,
    isDemo: shop.isDemo,
    ...resolveTranslations(shop.translations, locale),
  }));
}

async function create(input: CreateSectionInput) {
  const gate = await prisma.gate.findUnique({ where: { id: input.gateId } });
  if (!gate) throw ApiError.badRequest('Gate does not exist');

  const section = await prisma.section.create({
    data: {
      gateId: input.gateId,
      code: input.code,
      rowNumber: input.rowNumber ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      posX: input.posX ?? null,
      posY: input.posY ?? null,
      isDemo: input.isDemo ?? false,
      status: input.status ?? 'ACTIVE',
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
  return present(section, 'tj');
}

async function update(id: string, input: UpdateSectionInput) {
  const existing = await prisma.section.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Section');

  const section = await prisma.$transaction(async (tx) => {
    await tx.section.update({
      where: { id },
      data: {
        ...(input.gateId ? { gateId: input.gateId } : {}),
        ...(input.code ? { code: input.code } : {}),
        ...(input.rowNumber !== undefined ? { rowNumber: input.rowNumber } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.posX !== undefined ? { posX: input.posX } : {}),
        ...(input.posY !== undefined ? { posY: input.posY } : {}),
        ...(input.isDemo !== undefined ? { isDemo: input.isDemo } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
    if (input.translations) {
      for (const t of input.translations) {
        await tx.sectionTranslation.upsert({
          where: { sectionId_locale: { sectionId: id, locale: t.locale } },
          create: { sectionId: id, locale: t.locale, name: t.name, description: t.description ?? null },
          update: { name: t.name, description: t.description ?? null },
        });
      }
    }
    return tx.section.findUniqueOrThrow({ where: { id }, include: { translations: true } });
  });
  return present(section, 'tj');
}

async function remove(id: string) {
  const existing = await prisma.section.findUnique({
    where: { id },
    include: { _count: { select: { shops: true } } },
  });
  if (!existing) throw ApiError.notFound('Section');
  if (existing._count.shops > 0) {
    throw ApiError.badRequest('Cannot delete a section that still has shops');
  }
  await prisma.section.delete({ where: { id } });
}

export const sectionService = { list, getById, getShops, create, update, remove };
