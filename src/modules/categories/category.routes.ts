/**
 * Category routes — mounted at /api/v1/categories.
 *
 * Reads are public. Writes require ADMIN or SUPER_ADMIN (listed explicitly
 * because `authorize` does not auto-grant SUPER_ADMIN).
 */
import { Router } from 'express';
import * as categoryController from './category.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { asyncHandler } from '../../utils/async-handler';
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema,
  idParamSchema,
} from './category.validation';

const router = Router();

// ---- Public reads ----
router.get(
  '/',
  validate({ query: listCategoriesQuerySchema }),
  asyncHandler(categoryController.listPublic),
);
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(categoryController.getById));

// ---- Admin writes ----
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ body: createCategorySchema }),
  asyncHandler(categoryController.create),
);
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateCategorySchema }),
  asyncHandler(categoryController.update),
);
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema }),
  asyncHandler(categoryController.remove),
);

export default router;
