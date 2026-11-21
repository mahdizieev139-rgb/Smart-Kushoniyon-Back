/**
 * Product image routes — nested under /api/v1/products/:id/images.
 *
 * `mergeParams: true` lets this router read :id (the product id) from the
 * parent product router.
 */
import { Router } from 'express';
import * as productImageController from './product-image.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { imageUpload } from '../../middlewares/upload';
import { asyncHandler } from '../../utils/async-handler';

const router = Router({ mergeParams: true });

// Public: list a product's images.
router.get('/', asyncHandler(productImageController.list));

// Seller/admin: upload one or more images (field name: "images").
router.post(
  '/',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  imageUpload.array('images', 10),
  asyncHandler(productImageController.upload),
);

// Seller/admin: delete a single image.
router.delete(
  '/:imageId',
  authenticate,
  authorize('SELLER', 'ADMIN', 'SUPER_ADMIN'),
  asyncHandler(productImageController.remove),
);

export default router;
