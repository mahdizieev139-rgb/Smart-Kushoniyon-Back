/**
 * User management controller (admin / super-admin).
 */
import type { Request, Response } from 'express';
import { userService } from './user.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

export async function list(req: Request, res: Response) {
  const result = await userService.list(req.query as never);
  return sendSuccess(res, result.items, 'Users', 200, result.meta);
}

export async function getById(req: Request, res: Response) {
  const user = await userService.getById(req.params.id);
  return sendSuccess(res, user, 'User');
}

export async function update(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.update(req.params.id, req.body, req.user);
  return sendSuccess(res, user, 'User updated');
}

export async function createAdmin(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.createAdmin(req.body, req.user.id);
  return sendCreated(res, user, 'Admin account created');
}
