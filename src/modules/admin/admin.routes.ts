/**
 * Admin routes — mounted at /api/v1/admin.
 *
 * This aggregator groups every admin-only endpoint in one place so the required
 * API layout (/admin/shops, /admin/products/:id/approve, ...) is easy to see.
 *
 * Authorization rules:
 *   - ADMIN + SUPER_ADMIN: shop/product moderation, analytics, user listing.
 *   - SUPER_ADMIN ONLY:    change user roles, create admins, subscriptions,
 *                          system settings, audit logs.
 * `authenticate` runs for the whole router; `authorize(...)` is per-route.
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/async-handler';

import * as shopController from '../shops/shop.controller';
import * as productController from '../products/product.controller';
import * as analyticsController from '../analytics/analytics.controller';
import * as userController from '../users/user.controller';
import * as settingController from '../settings/setting.controller';
import * as auditLogController from '../audit-logs/audit-log.controller';

import { listShopsQuerySchema, idParamSchema as shopIdParam, rejectSchema as shopReject } from '../shops/shop.validation';
import { listProductsQuerySchema, idParamSchema as productIdParam, rejectSchema as productReject } from '../products/product.validation';
import { listUsersQuerySchema, updateUserSchema, createAdminSchema, idParamSchema as userIdParam } from '../users/user.validation';
import { upsertSettingSchema, keyParamSchema } from '../settings/setting.validation';

const router = Router();

// Everything under /admin requires a logged-in user.
router.use(authenticate);

const adminOrSuper = authorize('ADMIN', 'SUPER_ADMIN');
const superOnly = authorize('SUPER_ADMIN');

// ---- Analytics ----
router.get('/analytics', adminOrSuper, asyncHandler(analyticsController.adminOverview));

// ---- Shops moderation ----
router.get('/shops', adminOrSuper, validate({ query: listShopsQuerySchema }), asyncHandler(shopController.listAdmin));
router.patch('/shops/:id/approve', adminOrSuper, validate({ params: shopIdParam }), asyncHandler(shopController.approve));
router.patch('/shops/:id/reject', adminOrSuper, validate({ params: shopIdParam, body: shopReject }), asyncHandler(shopController.reject));
router.patch('/shops/:id/suspend', adminOrSuper, validate({ params: shopIdParam, body: shopReject }), asyncHandler(shopController.suspend));

// ---- Products moderation ----
router.get('/products', adminOrSuper, validate({ query: listProductsQuerySchema }), asyncHandler(productController.listAdmin));
router.patch('/products/:id/approve', adminOrSuper, validate({ params: productIdParam }), asyncHandler(productController.approve));
router.patch('/products/:id/reject', adminOrSuper, validate({ params: productIdParam, body: productReject }), asyncHandler(productController.reject));

// ---- Users ----
router.get('/users', adminOrSuper, validate({ query: listUsersQuerySchema }), asyncHandler(userController.list));
router.get('/users/:id', adminOrSuper, validate({ params: userIdParam }), asyncHandler(userController.getById));
// Status changes: ADMIN+; role changes are blocked inside the service unless SUPER_ADMIN.
router.patch('/users/:id', adminOrSuper, validate({ params: userIdParam, body: updateUserSchema }), asyncHandler(userController.update));
// Creating admin accounts is SUPER_ADMIN only.
router.post('/users', superOnly, validate({ body: createAdminSchema }), asyncHandler(userController.createAdmin));

// NOTE: Subscription routes were intentionally unmounted in v2 (monetization
// is out of scope). The Subscription/SubscriptionInvoice tables are KEPT so no
// data is lost; the module code was removed. Re-mount here if ever needed.

// ---- System settings (SUPER_ADMIN) ----
router.get('/settings', superOnly, asyncHandler(settingController.list));
router.get('/settings/:key', superOnly, validate({ params: keyParamSchema }), asyncHandler(settingController.getByKey));
router.put('/settings', superOnly, validate({ body: upsertSettingSchema }), asyncHandler(settingController.upsert));
router.delete('/settings/:key', superOnly, validate({ params: keyParamSchema }), asyncHandler(settingController.remove));

// ---- Audit logs (SUPER_ADMIN) ----
router.get('/audit-logs', superOnly, asyncHandler(auditLogController.list));

export default router;
