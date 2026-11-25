/**
 * API router — combines every module's routes under one place.
 *
 * app.ts mounts this at env.API_PREFIX (default /api/v1). To add a new module,
 * import its router and mount it here. This keeps route wiring in a single,
 * easy-to-scan file.
 */
import { Router } from 'express';
import authRouter from '../modules/auth/auth.routes';
import categoryRouter from '../modules/categories/category.routes';
import shopRouter from '../modules/shops/shop.routes';
import productRouter from '../modules/products/product.routes';
import gateRouter from '../modules/gates/gate.routes';
import sectionRouter from '../modules/sections/section.routes';
import marketMapRouter from '../modules/market-map/market-map.routes';
import searchRouter from '../modules/search/search.routes';
import advertisementRouter from '../modules/advertisements/advertisement.routes';
import adminRouter from '../modules/admin/admin.routes';
import sellerRouter from '../modules/seller/seller.routes';
import favoriteRouter from '../modules/favorites/favorite.routes';
import notificationRouter from '../modules/notifications/notification.routes';
import inquiryRouter from '../modules/inquiries/inquiry.routes';

export const apiRouter = Router();

// Simple health check used by load balancers / uptime monitors.
apiRouter.get('/health', (_req, res) => {
  res.json({ success: true, message: 'KUSHONIYON API is healthy', timestamp: new Date().toISOString() });
});

// --- Feature modules ---
apiRouter.use('/auth', authRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/shops', shopRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/gates', gateRouter);
apiRouter.use('/sections', sectionRouter);
apiRouter.use('/market-map', marketMapRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/advertisements', advertisementRouter);
apiRouter.use('/favorites', favoriteRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/inquiries', inquiryRouter);
apiRouter.use('/seller', sellerRouter);
// Admin aggregator groups /admin/shops, /admin/products, /admin/analytics,
// /admin/settings, /admin/audit-logs, etc.
apiRouter.use('/admin', adminRouter);
