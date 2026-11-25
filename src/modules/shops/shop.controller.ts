/**
 * Shop controller — thin HTTP layer over the shop service.
 *
 * Handlers are grouped by audience: public, seller (owner), and admin.
 */
import type { Request, Response } from 'express';
import { shopService } from './shop.service';
import { viewTrackingService } from '../analytics/view-tracking.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { parseLocale } from '../../utils/localization';
import { ApiError } from '../../utils/api-error';

// --- Public ---
export async function listPublic(req: Request, res: Response) {
  const result = await shopService.list({ ...req.query, publicOnly: true, locale: parseLocale(req.query.locale) });
  return sendSuccess(res, result.items, 'Shops', 200, result.meta);
}

export async function getById(req: Request, res: Response) {
  const shop = await shopService.getById(req.params.id, parseLocale(req.query.locale), req.user);
  await recordShopViewIfPublic(req, shop.id, shop.status);
  return sendSuccess(res, shop, 'Shop');
}

export async function getBySlug(req: Request, res: Response) {
  const shop = await shopService.getBySlug(req.params.slug, parseLocale(req.query.locale), req.user);
  await recordShopViewIfPublic(req, shop.id, shop.status);
  return sendSuccess(res, shop, 'Shop');
}

// v2: record a deduped, PII-free view for approved (public) shops only.
async function recordShopViewIfPublic(req: Request, shopId: string, status: string) {
  if (status !== 'APPROVED') return;
  const viewerKey = viewTrackingService.buildViewerKey(req.user?.id, req.ip);
  await viewTrackingService.recordShopView(shopId, viewerKey);
}

// --- Seller (owner) ---
export async function create(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const shop = await shopService.create(req.body, { id: req.user.id });
  return sendCreated(res, shop, 'Shop created and awaiting approval');
}

export async function update(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const shop = await shopService.update(req.params.id, req.body, req.user);
  return sendSuccess(res, shop, 'Shop updated');
}

export async function remove(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await shopService.softDelete(req.params.id, req.user);
  return sendSuccess(res, null, 'Shop deleted');
}

// Seller "my shops" list (only shops the current user is a member of).
export async function listMine(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const result = await shopService.list({ ...req.query, memberUserId: req.user.id, locale: parseLocale(req.query.locale) });
  return sendSuccess(res, result.items, 'My shops', 200, result.meta);
}

// --- Admin ---
export async function listAdmin(req: Request, res: Response) {
  const result = await shopService.list({ ...req.query, locale: parseLocale(req.query.locale) });
  return sendSuccess(res, result.items, 'Shops (admin)', 200, result.meta);
}

export async function approve(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const shop = await shopService.changeStatus(req.params.id, 'APPROVED', req.user);
  return sendSuccess(res, shop, 'Shop approved');
}

export async function reject(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const shop = await shopService.changeStatus(req.params.id, 'REJECTED', req.user, req.body?.reason);
  return sendSuccess(res, shop, 'Shop rejected');
}

export async function suspend(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const shop = await shopService.changeStatus(req.params.id, 'SUSPENDED', req.user, req.body?.reason);
  return sendSuccess(res, shop, 'Shop suspended');
}
