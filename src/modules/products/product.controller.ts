/**
 * Product controller — thin HTTP layer over the product service.
 */
import type { Request, Response } from 'express';
import { productService } from './product.service';
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
