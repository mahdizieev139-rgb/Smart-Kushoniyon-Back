/**
 * Analytics controller.
 */
import type { Request, Response } from 'express';
import { analyticsService } from './analytics.service';
import { sendSuccess } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

// Market-wide analytics (admins only).
export async function adminOverview(_req: Request, res: Response) {
  const overview = await analyticsService.getAdminOverview();
  return sendSuccess(res, overview, 'Market analytics');
}

// Seller dashboard — only the seller's own shops.
export async function sellerOverview(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const overview = await analyticsService.getSellerOverview(req.user.id);
  return sendSuccess(res, overview, 'Seller dashboard');
}
