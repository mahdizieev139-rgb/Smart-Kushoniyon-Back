/**
 * Advertisement controller.
 */
import type { Request, Response } from 'express';
import { advertisementService } from './advertisement.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

// Public: only currently-active ads.
export async function listPublic(req: Request, res: Response) {
  const result = await advertisementService.list({ ...req.query, publicOnly: true });
  return sendSuccess(res, result.items, 'Active advertisements', 200, result.meta);
}

// Owner/admin: full listing with filters.
export async function listManaged(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  // Admins see everything; sellers see only their own shops' ads.
  const scope = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' ? {} : { memberUserId: req.user.id };
  const result = await advertisementService.list({ ...req.query, ...scope });
  return sendSuccess(res, result.items, 'Advertisements', 200, result.meta);
}

export async function getById(req: Request, res: Response) {
  const ad = await advertisementService.getById(req.params.id);
  return sendSuccess(res, ad, 'Advertisement');
}

export async function create(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const ad = await advertisementService.create(req.body, req.user);
  return sendCreated(res, ad, 'Advertisement created');
}

export async function update(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const ad = await advertisementService.update(req.params.id, req.body, req.user);
  return sendSuccess(res, ad, 'Advertisement updated');
}

// Lifecycle action (submit/approve/reject/activate/pause/end) via ?action.
export async function changeStatus(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const ad = await advertisementService.changeStatus(req.params.id, req.body.action, req.user);
  return sendSuccess(res, ad, `Advertisement ${req.body.action} done`);
}
