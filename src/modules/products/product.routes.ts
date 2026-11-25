/**
 * Product routes — mounted at /api/v1/products.
 *
 * Public:  list, get by id.
 * Seller:  create / update / delete own products (SELLER + admins).
 * Images:  nested under /products/:id/images (see product-images module).
 *
 * Admin approve/reject live under /admin/products (see admin routes).
 */
import { Router } from 'express';
import * as productController from './product.controller';
import productImageRouter from '../product-images/product-image.routes';
import { validate } from '../../middlewares/validate';
import { authenticate, optionalAuthenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { asyncHandler } from '../../utils/async-handler';
import {
  createProductSchema,
  updateProductSchema,
  updateStockSchema,
  listProductsQuerySchema,
  idParamSchema,
} from './product.validation';

const router = Router();

// ---- Public reads ----
router.get('/', validate({ query: listProductsQuerySchema }), asyncHandler(productController.listPublic));
// v2: public price comparison + price history (declared before /:id catch-all).
router.get('/:id/compare', validate({ params: idParamSchema }), asyncHandler(productController.compare));
router.get('/:id/price-history', validate({ params: idParamSchema }), asyncHandler(productController.priceHistory));
router.get(
  '/:id',
  optionalAuthenticate,
  validate({ params: idParamSchema }),
  asyncHandler(productController.getById),
);

// ---- Seller writes ----
router.post(
  '/',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ body: createProductSchema }),
  asyncHandler(productController.create),
);
router.patch(
  '/:id',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateProductSchema }),
  asyncHandler(productController.update),
);
router.delete(
  '/:id',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema }),
  asyncHandler(productController.remove),
);
// v2: dedicated stock/availability update (seller + admins).
router.patch(
  '/:id/stock',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  validate({ params: idParamSchema, body: updateStockSchema }),
  asyncHandler(productController.updateStock),
);

// ---- Nested image routes: /products/:id/images ----
router.use('/:id/images', productImageRouter);

export default router;
