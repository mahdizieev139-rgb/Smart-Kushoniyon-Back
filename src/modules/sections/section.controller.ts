/**
 * Section controller — thin HTTP layer over the section service.
 */
import type { Request, Response } from 'express';
import { sectionService } from './section.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { parseLocale } from '../../utils/localization';

export async function listPublic(req: Request, res: Response) {
  const sections = await sectionService.list({
    locale: parseLocale(req.query.locale),
    gateId: req.query.gateId as string | undefined,
    publicOnly: true,
  });
  return sendSuccess(res, sections, 'Sections');
}

export async function listAdmin(req: Request, res: Response) {
  const sections = await sectionService.list({
    locale: parseLocale(req.query.locale),
    gateId: req.query.gateId as string | undefined,
    status: req.query.status as 'ACTIVE' | 'INACTIVE' | undefined,
  });
  return sendSuccess(res, sections, 'Sections (admin)');
}

export async function getById(req: Request, res: Response) {
  const section = await sectionService.getById(req.params.id, parseLocale(req.query.locale));
  return sendSuccess(res, section, 'Section');
}

export async function getShops(req: Request, res: Response) {
  const shops = await sectionService.getShops(req.params.id, parseLocale(req.query.locale));
  return sendSuccess(res, shops, 'Shops in section');
}

export async function create(req: Request, res: Response) {
  const section = await sectionService.create(req.body);
  return sendCreated(res, section, 'Section created');
}

export async function update(req: Request, res: Response) {
  const section = await sectionService.update(req.params.id, req.body);
  return sendSuccess(res, section, 'Section updated');
}

export async function remove(req: Request, res: Response) {
  await sectionService.remove(req.params.id);
  return sendSuccess(res, null, 'Section deleted');
}
