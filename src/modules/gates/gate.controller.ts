/**
 * Gate controller — thin HTTP layer over the gate service.
 */
import type { Request, Response } from 'express';
import { gateService } from './gate.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { parseLocale } from '../../utils/localization';

export async function listPublic(req: Request, res: Response) {
  const gates = await gateService.list({ locale: parseLocale(req.query.locale), publicOnly: true });
  return sendSuccess(res, gates, 'Gates');
}

export async function listAdmin(req: Request, res: Response) {
  const gates = await gateService.list({
    locale: parseLocale(req.query.locale),
    status: req.query.status as 'ACTIVE' | 'INACTIVE' | undefined,
  });
  return sendSuccess(res, gates, 'Gates (admin)');
}

export async function getById(req: Request, res: Response) {
  const gate = await gateService.getById(req.params.id, parseLocale(req.query.locale));
  return sendSuccess(res, gate, 'Gate');
}

export async function create(req: Request, res: Response) {
  const gate = await gateService.create(req.body);
  return sendCreated(res, gate, 'Gate created');
}

export async function update(req: Request, res: Response) {
  const gate = await gateService.update(req.params.id, req.body);
  return sendSuccess(res, gate, 'Gate updated');
}

export async function remove(req: Request, res: Response) {
  await gateService.remove(req.params.id);
  return sendSuccess(res, null, 'Gate deleted');
}
