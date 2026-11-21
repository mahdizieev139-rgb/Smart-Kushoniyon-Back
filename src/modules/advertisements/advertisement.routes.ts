/**
 * Advertisement routes — mounted at /api/v1/advertisements.
 *
 * Public:  GET /           -> currently active ads.
 * Managed: GET /manage     -> owner/admin listing with filters.
 * Writes:  create/update/status change (SELLER + admins).
 */
import { Router } from 'express';
import * as adController from './advertisement.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { asyncHandler } from '../../utils/async-handler';
import {
  createAdvertisementSchema,
  updateAdvertisementSchema,
  listAdvertisementsQuerySchema,
  statusActionSchema,
  idParamSchema,
} from './advertisement.validation';

const router = Router();

// Public list of active ads.
router.get('/', validate({ query: listAdvertisementsQuerySchema }), asyncHandler(adController.listPublic));

// Managed listing (must be authenticated).
router.get(
  '/manage',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ query: listAdvertisementsQuerySchema }),
  asyncHandler(adController.listManaged),
);

router.get('/:id', validate({ params: idParamSchema }), asyncHandler(adController.getById));

router.post(
  '/',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ body: createAdvertisementSchema }),
  asyncHandler(adController.create),
);
router.patch(
  '/:id',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateAdvertisementSchema }),
  asyncHandler(adController.update),
);
// Lifecycle actions: body { action: "approve" | "pause" | ... }
router.patch(
  '/:id/status',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema, body: statusActionSchema }),
  asyncHandler(adController.changeStatus),
);

export default router;
