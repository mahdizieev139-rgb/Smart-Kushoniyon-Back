/**
 * Section routes — mounted at /api/v1/sections.
 * Public reads (incl. /:id/shops); admin writes.
 */
import { Router } from 'express';
import * as sectionController from './section.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { asyncHandler } from '../../utils/async-handler';
import {
  createSectionSchema,
  updateSectionSchema,
  listSectionsQuerySchema,
  idParamSchema,
} from './section.validation';

const router = Router();

router.get('/', validate({ query: listSectionsQuerySchema }), asyncHandler(sectionController.listPublic));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(sectionController.getById));
router.get('/:id/shops', validate({ params: idParamSchema }), asyncHandler(sectionController.getShops));

router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ body: createSectionSchema }),
  asyncHandler(sectionController.create),
);
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateSectionSchema }),
  asyncHandler(sectionController.update),
);
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema }),
  asyncHandler(sectionController.remove),
);

export default router;
