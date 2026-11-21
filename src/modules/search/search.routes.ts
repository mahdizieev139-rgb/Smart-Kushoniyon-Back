/**
 * Search routes — mounted at /api/v1/search.
 * Public, read-only. Only approved/active records are returned.
 */
import { Router } from 'express';
import * as searchController from './search.controller';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/async-handler';
import { searchQuerySchema } from './search.validation';

const router = Router();

router.get('/', validate({ query: searchQuerySchema }), asyncHandler(searchController.search));

export default router;
