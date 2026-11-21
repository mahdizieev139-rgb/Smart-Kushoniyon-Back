/**
 * Auth routes — wires HTTP paths to controllers.
 *
 * Mounted at: /api/v1/auth
 *
 * The auth-sensitive endpoints (register/login/refresh) use the stricter
 * `authLimiter` to slow brute-force attempts.
 */
import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authLimiter } from '../../middlewares/rate-limit';
import { asyncHandler } from '../../utils/async-handler';
import { registerSchema, loginSchema } from './auth.validation';

const router = Router();

router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(authController.register),
);

router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);

router.post('/refresh', authLimiter, asyncHandler(authController.refresh));

router.post('/logout', asyncHandler(authController.logout));

router.get('/me', authenticate, asyncHandler(authController.me));

export default router;
