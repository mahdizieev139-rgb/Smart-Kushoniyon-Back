/**
 * Inquiry controller. The actor (id + role) always comes from req.user.
 */
import type { Request, Response } from 'express';
import { inquiryService } from './inquiry.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

export async function create(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const inquiry = await inquiryService.create(req.body, req.user);
  return sendCreated(res, inquiry, 'Inquiry created');
}

export async function list(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const result = await inquiryService.list(req.user, req.query as never);
  return sendSuccess(res, result.items, 'Inquiries', 200, result.meta);
}

export async function getById(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const inquiry = await inquiryService.getById(req.params.id, req.user);
  return sendSuccess(res, inquiry, 'Inquiry');
}

export async function addMessage(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const inquiry = await inquiryService.addMessage(req.params.id, req.user, req.body.message);
  return sendCreated(res, inquiry, 'Message sent');
}

export async function resolve(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const inquiry = await inquiryService.resolve(req.params.id, req.user);
  return sendSuccess(res, inquiry, 'Inquiry resolved');
}
