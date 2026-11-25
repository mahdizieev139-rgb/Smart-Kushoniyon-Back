/**
 * Gate service — market entrance gates.
 *
 * Public users can read gates (for the map). Only admins manage them.
 * Coordinates are optional and left null until verified.
 */
import type { Prisma, Locale } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';
import { resolveTranslations } from '../../utils/localization';
import type { CreateGateInput, UpdateGateInput } from './gate.validation';

type GateFull = Prisma.GateGetPayload<{ include: { translations: true } }>;

function present(gate: GateFull, locale: Locale) {
  const { translations, ...rest } = resolveTranslations(gate.translations, locale);
  return {
    id: gate.id,
    code: gate.code,
    // Decimal | null -> number | null for the client.
    latitude: gate.latitude ? Number(gate.latitude) : null,
    longitude: gate.longitude ? Number(gate.longitude) : null,
    posX: gate.posX ? Number(gate.posX) : null,
    posY: gate.posY ? Number(gate.posY) : null,
    isDemo: gate.isDemo,
    status: gate.status,
    name: rest.name,
    translations,
    createdAt: gate.createdAt,
    updatedAt: gate.updatedAt,
  };
}

async function list(params: { locale?: Locale; status?: 'ACTIVE' | 'INACTIVE'; publicOnly?: boolean }) {
  const locale: Locale = params.locale ?? 'tj';
  const where: Prisma.GateWhereInput = params.publicOnly
    ? { status: 'ACTIVE' }
    : params.status
      ? { status: params.status }
      : {};

  const gates = await prisma.gate.findMany({
    where,
    include: { translations: true },
    orderBy: { code: 'asc' },
  });
  return gates.map((g) => present(g, locale));
}

async function getById(id: string, locale: Locale = 'tj') {
  const gate = await prisma.gate.findUnique({ where: { id }, include: { translations: true } });
  if (!gate) throw ApiError.notFound('Gate');
  return present(gate, locale);
}

async function create(input: CreateGateInput) {
  const gate = await prisma.gate.create({
    data: {
      code: input.code,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      posX: input.posX ?? null,
      posY: input.posY ?? null,
      isDemo: input.isDemo ?? false,
      status: input.status ?? 'ACTIVE',
      translations: { create: input.translations.map((t) => ({ locale: t.locale, name: t.name })) },
    },
    include: { translations: true },
  });
  return present(gate, 'tj');
}

async function update(id: string, input: UpdateGateInput) {
  const existing = await prisma.gate.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Gate');

  const gate = await prisma.$transaction(async (tx) => {
    await tx.gate.update({
      where: { id },
      data: {
        ...(input.code ? { code: input.code } : {}),
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
        await tx.gateTranslation.upsert({
          where: { gateId_locale: { gateId: id, locale: t.locale } },
          create: { gateId: id, locale: t.locale, name: t.name },
          update: { name: t.name },
        });
      }
    }
    return tx.gate.findUniqueOrThrow({ where: { id }, include: { translations: true } });
  });
  return present(gate, 'tj');
}

async function remove(id: string) {
  const existing = await prisma.gate.findUnique({
    where: { id },
    include: { _count: { select: { sections: true } } },
  });
  if (!existing) throw ApiError.notFound('Gate');
  if (existing._count.sections > 0) {
    throw ApiError.badRequest('Cannot delete a gate that still has sections');
  }
  await prisma.gate.delete({ where: { id } });
}

export const gateService = { list, getById, create, update, remove };
