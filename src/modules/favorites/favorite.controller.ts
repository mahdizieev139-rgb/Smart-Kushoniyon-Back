/**
 * Favorites controller. All routes require authentication; the user id always
 * comes from the verified token (req.user), never from the request body.
 */
import type { Request, Response } from 'express';
import { favoriteService } from './favorite.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { parseLocale } from '../../utils/localization';
import { ApiError } from '../../utils/api-error';

export async function list(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const data = await favoriteService.list(req.user.id, parseLocale(req.query.locale));
  return sendSuccess(res, data, 'Favorites');
}

export async function addProduct(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await favoriteService.addProduct(req.user.id, req.params.productId);
  return sendCreated(res, null, 'Product added to favorites');
}

export async function removeProduct(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await favoriteService.removeProduct(req.user.id, req.params.productId);
  return sendSuccess(res, null, 'Product removed from favorites');
}

export async function addShop(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await favoriteService.addShop(req.user.id, req.params.shopId);
  return sendCreated(res, null, 'Shop added to favorites');
}

export async function removeShop(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await favoriteService.removeShop(req.user.id, req.params.shopId);
  return sendSuccess(res, null, 'Shop removed from favorites');
}
