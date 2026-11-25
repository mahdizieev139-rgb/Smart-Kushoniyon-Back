/**
 * Notification controller. Every action is scoped to the authenticated user.
 */
import type { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { sendSuccess } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

export async function list(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const result = await notificationService.list(req.user.id, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    unreadOnly: req.query.unreadOnly === 'true',
  });
  return sendSuccess(res, result.items, 'Notifications', 200, result.meta);
}

export async function markRead(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const notification = await notificationService.markRead(req.user.id, req.params.id);
  return sendSuccess(res, notification, 'Notification marked as read');
}

export async function markAllRead(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const result = await notificationService.markAllRead(req.user.id);
  return sendSuccess(res, result, 'All notifications marked as read');
}

export async function remove(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await notificationService.remove(req.user.id, req.params.id);
  return sendSuccess(res, null, 'Notification deleted');
}
