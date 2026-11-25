/**
 * Product controller — thin HTTP layer over the product service.
 */
import type { Request, Response } from 'express';
import { productService } from './product.service';
import { priceHistoryService } from '../price-history/price-history.service';
import { priceComparisonService } from '../price-comparison/price-comparison.service';
import { viewTrackingService } from '../analytics/view-tracking.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { parseLocale } from '../../utils/localization';
import { ApiError } from '../../utils/api-error';

// --- Public ---
export async function listPublic(req: Request, res: Response) {
  const result = await productService.list({ ...req.query, publicOnly: true, locale: parseLocale(req.query.locale) });
  return sendSuccess(res, result.items, 'Products', 200, result.meta);
}

export async function getById(req: Request, res: Response) {
  const product = await productService.getById(req.params.id, parseLocale(req.query.locale), req.user);
  // v2: record a (deduped, PII-free) view for approved products only.
  if (product.status === 'APPROVED') {
    const viewerKey = viewTrackingService.buildViewerKey(req.user?.id, req.ip);
    await viewTrackingService.recordProductView(product.id, viewerKey);
  }
  return sendSuccess(res, product, 'Product');
}

// --- Seller (owner) ---
export async function create(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const product = await productService.create(req.body, req.user);
  return sendCreated(res, product, 'Product created and awaiting approval');
}

export async function update(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const product = await productService.update(req.params.id, req.body, req.user);
  return sendSuccess(res, product, 'Product updated');
}

export async function remove(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await productService.softDelete(req.params.id, req.user);
  return sendSuccess(res, null, 'Product deleted');
}

// v2: seller updates stock/availability for their own product.
export async function updateStock(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const product = await productService.updateStock(req.params.id, req.body, req.user);
  return sendSuccess(res, product, 'Stock updated');
}

// v2: public price history for a product.
export async function priceHistory(req: Request, res: Response) {
  const result = await priceHistoryService.list(req.params.id, req.query as never);
  return sendSuccess(res, result.items, 'Price history', 200, result.meta);
}

// v2: public price comparison across shops.
export async function compare(req: Request, res: Response) {
  const result = await priceComparisonService.compare(req.params.id, {
    locale: parseLocale(req.query.locale),
    sort: req.query.sort as 'price_asc' | 'price_desc' | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  return sendSuccess(res, result, 'Price comparison');
}

export async function listMine(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const result = await productService.list({ ...req.query, memberUserId: req.user.id, locale: parseLocale(req.query.locale) });
  return sendSuccess(res, result.items, 'My products', 200, result.meta);
}

// --- Admin ---
export async function listAdmin(req: Request, res: Response) {
  const result = await productService.list({ ...req.query, locale: parseLocale(req.query.locale) });
  return sendSuccess(res, result.items, 'Products (admin)', 200, result.meta);
}

export async function approve(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const product = await productService.changeStatus(req.params.id, 'APPROVED', req.user);
  return sendSuccess(res, product, 'Product approved');
}

export async function reject(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const product = await productService.changeStatus(req.params.id, 'REJECTED', req.user, req.body?.reason);
  return sendSuccess(res, product, 'Product rejected');
}
