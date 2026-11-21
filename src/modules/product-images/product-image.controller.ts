/**
 * Product image controller.
 *
 * Mounted with mergeParams so `req.params.id` (the product id) from the parent
 * /products/:id route is available here.
 */
import type { Request, Response } from 'express';
import { productImageService } from './product-image.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

export async function list(req: Request, res: Response) {
  const images = await productImageService.list(req.params.id);
  return sendSuccess(res, images, 'Product images');
}

export async function upload(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  // Multer places uploaded files on req.files (array form).
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const images = await productImageService.upload(req.params.id, files, req.user);
  return sendCreated(res, images, 'Images uploaded');
}

export async function remove(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await productImageService.remove(req.params.id, req.params.imageId, req.user);
  return sendSuccess(res, null, 'Image deleted');
}
