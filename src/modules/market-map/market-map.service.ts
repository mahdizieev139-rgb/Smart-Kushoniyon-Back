/**
 * Market map service — read-only aggregation for the interactive map.
 *
 * Returns the whole structure in one call: active gates, their active sections,
 * each section's coordinates, and how many approved shops are in each section.
 *
 * Coordinates may be null (not yet verified) — the frontend decides how to
 * render sections without positions. We never invent coordinates here.
 *
 * The schema is ready for future indoor maps / custom geometry: we already keep
 * latitude/longitude per gate and section, and the map payload is a simple
 * nested JSON that can be extended (e.g. with polygon shapes) later.
 */
import type { Locale } from '@prisma/client';
import { prisma } from '../../config/database';
import { resolveTranslations } from '../../utils/localization';

async function getMap(locale: Locale = 'tj') {
  const gates = await prisma.gate.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { code: 'asc' },
    include: {
      translations: true,
      sections: {
        where: { status: 'ACTIVE' },
        orderBy: { code: 'asc' },
        include: {
          translations: true,
          // Count only approved, non-deleted shops per section.
          _count: { select: { shops: { where: { status: 'APPROVED', deletedAt: null } } } },
        },
      },
    },
  });

  return gates.map((gate) => ({
    id: gate.id,
    code: gate.code,
    // Real GPS (may be null until verified).
    latitude: gate.latitude ? Number(gate.latitude) : null,
    longitude: gate.longitude ? Number(gate.longitude) : null,
    // Schematic (indoor floor-plan) position, 0..1 relative coordinates.
    posX: gate.posX ? Number(gate.posX) : null,
    posY: gate.posY ? Number(gate.posY) : null,
    isDemo: gate.isDemo,
    name: resolveTranslations(gate.translations, locale).name,
    sections: gate.sections.map((section) => ({
      id: section.id,
      code: section.code,
      rowNumber: section.rowNumber,
      latitude: section.latitude ? Number(section.latitude) : null,
      longitude: section.longitude ? Number(section.longitude) : null,
      posX: section.posX ? Number(section.posX) : null,
      posY: section.posY ? Number(section.posY) : null,
      isDemo: section.isDemo,
      ...resolveTranslations(section.translations, locale),
      shopCount: section._count.shops,
    })),
  }));
}

export const marketMapService = { getMap };
