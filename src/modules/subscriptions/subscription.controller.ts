/**
 * Subscription controller (admin-facing).
 */
import type { Request, Response } from 'express';
import { subscriptionService } from './subscription.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { ApiError } from '../../utils/api-error';

export async function listPlans(_req: Request, res: Response) {
  const plans = await subscriptionService.getPlans();
  return sendSuccess(res, plans, 'Subscription plans');
}

export async function updatePlans(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const plans = await subscriptionService.setPlans(req.body, req.user.id);
  return sendSuccess(res, plans, 'Plans updated');
}

export async function list(req: Request, res: Response) {
  const result = await subscriptionService.list(req.query as never);
  return sendSuccess(res, result.items, 'Subscriptions', 200, result.meta);
}

export async function getById(req: Request, res: Response) {
  const subscription = await subscriptionService.getById(req.params.id);
  return sendSuccess(res, subscription, 'Subscription');
}

export async function create(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const subscription = await subscriptionService.create(req.body, req.user.id);
  return sendCreated(res, subscription, 'Subscription created');
}

export async function update(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const subscription = await subscriptionService.update(req.params.id, req.body, req.user.id);
  return sendSuccess(res, subscription, 'Subscription updated');
}

export async function recordInvoice(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const invoice = await subscriptionService.recordInvoice(
    req.params.id,
    req.body.status,
    req.body.note,
    req.user.id,
  );
  return sendSuccess(res, invoice, 'Invoice updated');
}
