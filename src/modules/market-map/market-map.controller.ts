/**
 * Market map controller.
 */
import type { Request, Response } from 'express';
import { marketMapService } from './market-map.service';
import { sendSuccess } from '../../utils/api-response';
import { parseLocale } from '../../utils/localization';

export async function getMap(req: Request, res: Response) {
  const map = await marketMapService.getMap(parseLocale(req.query.locale));
  return sendSuccess(res, map, 'Market map');
}
