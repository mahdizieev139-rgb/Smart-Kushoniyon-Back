/**
 * Analytics controller.
 */
import type { Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { sendSuccess } from '../../utils/api-response';
import { parseLocale } from '../../utils/localization';
import { ApiError } from '../../utils/api-error';

// Market-wide analytics (admins only).
export async function adminOverview(_req: Request, res: Response) {
  const overview = await analyticsService.getAdminOverview();
  return sendSuccess(res, overview, 'Market analytics');
}

// Seller dashboard — only the seller's own shops (product counts).
export async function sellerOverview(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const overview = await analyticsService.getSellerOverview(req.user.id);
  return sendSuccess(res, overview, 'Seller dashboard');
}

// v2: richer seller analytics (counts + views + highlights).
export async function sellerAnalytics(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const data = await analyticsService.getSellerAnalyticsOverview(req.user.id, parseLocale(req.query.locale));
  return sendSuccess(res, data, 'Seller analytics');
}

export async function sellerProductAnalytics(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const data = await analyticsService.getSellerProductAnalytics(req.user.id, parseLocale(req.query.locale));
  return sendSuccess(res, data, 'Seller product analytics');
}

export async function sellerShopAnalytics(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const data = await analyticsService.getSellerShopAnalytics(req.user.id, parseLocale(req.query.locale));
  return sendSuccess(res, data, 'Seller shop analytics');
}
