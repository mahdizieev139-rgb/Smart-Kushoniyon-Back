/**
 * Category controller — thin HTTP layer over the category service.
 */
import type { Request, Response } from 'express';
import { categoryService } from './category.service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { parseLocale } from '../../utils/localization';

// Public listing: only ACTIVE categories are shown to everyone.
export async function listPublic(req: Request, res: Response) {
  const result = await categoryService.list({
    page: req.query.page as number | undefined,
    limit: req.query.limit as number | undefined,
    locale: parseLocale(req.query.locale),
    parentId: req.query.parentId as string | undefined,
    publicOnly: true,
  });
  return sendSuccess(res, result.items, 'Categories', 200, result.meta);
}

// Admin listing: can filter by any status.
export async function listAdmin(req: Request, res: Response) {
  const result = await categoryService.list({
    page: req.query.page as number | undefined,
    limit: req.query.limit as number | undefined,
    locale: parseLocale(req.query.locale),
    parentId: req.query.parentId as string | undefined,
    status: req.query.status as 'ACTIVE' | 'ARCHIVED' | undefined,
  });
  return sendSuccess(res, result.items, 'Categories', 200, result.meta);
}

export async function getById(req: Request, res: Response) {
  const category = await categoryService.getById(req.params.id, parseLocale(req.query.locale));
  return sendSuccess(res, category, 'Category');
}

export async function create(req: Request, res: Response) {
  const category = await categoryService.create(req.body);
  return sendCreated(res, category, 'Category created');
}

export async function update(req: Request, res: Response) {
  const category = await categoryService.update(req.params.id, req.body);
  return sendSuccess(res, category, 'Category updated');
}

export async function remove(req: Request, res: Response) {
  const result = await categoryService.remove(req.params.id);
  return sendSuccess(res, result, result.archived ? 'Category archived' : 'Category deleted');
}
