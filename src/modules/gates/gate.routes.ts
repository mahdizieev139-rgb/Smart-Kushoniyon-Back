/**
 * Gate routes — mounted at /api/v1/gates.
 * Public reads; admin writes.
 */
import { Router } from 'express';
import * as gateController from './gate.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { asyncHandler } from '../../utils/async-handler';
import {
  createGateSchema,
  updateGateSchema,
  listGatesQuerySchema,
  idParamSchema,
} from './gate.validation';

const router = Router();

router.get('/', validate({ query: listGatesQuerySchema }), asyncHandler(gateController.listPublic));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(gateController.getById));

router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ body: createGateSchema }),
  asyncHandler(gateController.create),
);
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateGateSchema }),
  asyncHandler(gateController.update),
);
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema }),
  asyncHandler(gateController.remove),
);

export default router;
