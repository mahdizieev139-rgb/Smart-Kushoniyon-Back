/**
 * Favorites routes — mounted at /api/v1/favorites.
 *
 * All routes require authentication. Any logged-in user may use favorites
 * (customers primarily, but sellers/admins can too). Guests are rejected.
 */
import { Router } from 'express';
import * as favoriteController from './favorite.controller';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/async-handler';
import { z } from 'zod';

const productParam = z.object({ productId: z.string().uuid('Invalid product id') });
const shopParam = z.object({ shopId: z.string().uuid('Invalid shop id') });

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(favoriteController.list));

router.post('/products/:productId', validate({ params: productParam }), asyncHandler(favoriteController.addProduct));
router.delete('/products/:productId', validate({ params: productParam }), asyncHandler(favoriteController.removeProduct));

router.post('/shops/:shopId', validate({ params: shopParam }), asyncHandler(favoriteController.addShop));
router.delete('/shops/:shopId', validate({ params: shopParam }), asyncHandler(favoriteController.removeShop));

export default router;
