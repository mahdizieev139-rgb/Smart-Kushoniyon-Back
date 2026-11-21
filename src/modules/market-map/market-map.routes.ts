/**
 * Market map routes — mounted at /api/v1/market-map.
 * Public, read-only.
 */
import { Router } from 'express';
import * as marketMapController from './market-map.controller';
import { asyncHandler } from '../../utils/async-handler';

const router = Router();

router.get('/', asyncHandler(marketMapController.getMap));

export default router;
