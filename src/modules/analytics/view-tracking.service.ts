/**
 * View tracking service.
 *
 * Records product/shop views for seller analytics. To keep this cheap and avoid
 * inflating counts, we store at most ONE row per (entity, viewer, day) using the
 * unique constraint in the schema: a repeat view the same day simply fails the
 * insert and is ignored. `viewerKey` is a user id when logged in, otherwise a
 * hashed IP — never raw PII.
 *
 * All functions are best-effort: a tracking failure must never break the page
 * the user is actually viewing, so errors are swallowed (logged at debug).
 */
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

// Build a non-identifying viewer key. Prefer the user id; fall back to a hash
// of the IP so we do not store the raw address.
export function buildViewerKey(userId: string | undefined, ip: string | undefined): string {
  if (userId) return `u:${userId}`;
  const hash = createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 32);
  return `ip:${hash}`;
}

// Midnight UTC today — the dedup bucket for @db.Date.
function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function isDuplicate(error: unknown): Promise<boolean> {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function recordProductView(productId: string, viewerKey: string): Promise<void> {
  try {
    await prisma.productView.create({ data: { productId, viewerKey, viewedOn: todayUtc() } });
  } catch (error) {
    // A duplicate (same viewer, same day) is expected and intentionally ignored.
    if (!(await isDuplicate(error))) logger.debug({ error, productId }, 'recordProductView failed');
  }
}

async function recordShopView(shopId: string, viewerKey: string): Promise<void> {
  try {
    await prisma.shopView.create({ data: { shopId, viewerKey, viewedOn: todayUtc() } });
  } catch (error) {
    if (!(await isDuplicate(error))) logger.debug({ error, shopId }, 'recordShopView failed');
  }
}

export const viewTrackingService = { buildViewerKey, recordProductView, recordShopView };
