/**
 * Search controller.
 */
import type { Request, Response } from 'express';
import { searchService } from './search.service';
import { sendSuccess } from '../../utils/api-response';

export async function search(req: Request, res: Response) {
  const result = await searchService.search(req.query as never);
  return sendSuccess(
    res,
    { results: result.results, counts: result.counts },
    'Search results',
    200,
    result.meta,
  );
}
