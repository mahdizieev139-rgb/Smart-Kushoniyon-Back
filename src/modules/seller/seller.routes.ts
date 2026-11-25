/**
 * Seller routes — mounted at /api/v1/seller.
 *
 * All endpoints are scoped to the CURRENT user's shops (by membership), so a
 * seller can never see another seller's data. Admins may also use these (they
 * will simply see the shops they are members of, usually none).
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/async-handler';

import * as analyticsController from '../analytics/analytics.controller';
import * as shopController from '../shops/shop.controller';
import * as productController from '../products/product.controller';
import { listShopsQuerySchema } from '../shops/shop.validation';
import { listProductsQuerySchema } from '../products/product.validation';

const router = Router();

router.use(authenticate, authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'));

// Seller dashboard — aggregate stats for the seller's own shops.
router.get('/dashboard', asyncHandler(analyticsController.sellerOverview));

// v2: richer analytics (views + highlights). Scoped to the seller's own shops.
router.get('/analytics', asyncHandler(analyticsController.sellerAnalytics));
router.get('/analytics/products', asyncHandler(analyticsController.sellerProductAnalytics));
router.get('/analytics/shops', asyncHandler(analyticsController.sellerShopAnalytics));

// The seller's own shops and products.
router.get('/shops', validate({ query: listShopsQuerySchema }), asyncHandler(shopController.listMine));
router.get('/products', validate({ query: listProductsQuerySchema }), asyncHandler(productController.listMine));

export default router;
