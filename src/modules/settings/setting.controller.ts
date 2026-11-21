/**
 * System settings controller (SUPER_ADMIN).
 */
import type { Request, Response } from 'express';
import { settingService } from './setting.service';
import { sendSuccess } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

export async function list(_req: Request, res: Response) {
  const settings = await settingService.list();
  return sendSuccess(res, settings, 'System settings');
}

export async function getByKey(req: Request, res: Response) {
  const setting = await settingService.getByKey(req.params.key);
  return sendSuccess(res, setting, 'Setting');
}

export async function upsert(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const setting = await settingService.upsert(req.body.key, req.body.value, req.user.id);
  return sendSuccess(res, setting, 'Setting saved');
}

export async function remove(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await settingService.remove(req.params.key, req.user.id);
  return sendSuccess(res, null, 'Setting deleted');
}
