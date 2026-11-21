/**
 * Shop routes — mounted at /api/v1/shops.
 *
 * Public:  list, get by id, get by slug.
 * Seller:  create / update / delete own shops (SELLER or admins).
 *
 * Admin-only status changes (approve/reject/suspend) live under /admin/shops
 * (see modules/shops/shop.admin.routes.ts) to match the required API layout.
 */
import { Router } from 'express';
import * as shopController from './shop.controller';
import shopMemberRouter from '../shop-members/shop-member.routes';
import { validate } from '../../middlewares/validate';
import { authenticate, optionalAuthenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { asyncHandler } from '../../utils/async-handler';
import {
  createShopSchema,
  updateShopSchema,
  listShopsQuerySchema,
  idParamSchema,
  slugParamSchema,
} from './shop.validation';

const router = Router();

// ---- Public reads (optional auth so members can preview pending shops) ----
router.get('/', validate({ query: listShopsQuerySchema }), asyncHandler(shopController.listPublic));
router.get(
  '/slug/:slug',
  optionalAuthenticate,
  validate({ params: slugParamSchema }),
  asyncHandler(shopController.getBySlug),
);
router.get(
  '/:id',
  optionalAuthenticate,
  validate({ params: idParamSchema }),
  asyncHandler(shopController.getById),
);

// ---- Seller writes (SELLER + admins) ----
router.post(
  '/',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ body: createShopSchema }),
  asyncHandler(shopController.create),
);
router.patch(
  '/:id',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateShopSchema }),
  asyncHandler(shopController.update),
);
router.delete(
  '/:id',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema }),
  asyncHandler(shopController.remove),
);

// ---- Nested member management: /shops/:id/members ----
router.use('/:id/members', shopMemberRouter);

export default router;
