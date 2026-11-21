/**
 * authorize — Role-Based Access Control (RBAC).
 *
 * Use AFTER `authenticate`. Pass the roles allowed to access the route:
 *
 *   router.get('/admin/shops', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), handler)
 *
 * If the authenticated user's role is not in the allowed list, we return 403.
 * SUPER_ADMIN is NOT automatically allowed everywhere — list it explicitly
 * where appropriate, so access is always obvious from the route definition.
 */
import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { ApiError } from '../utils/api-error';

export function authorize(...allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      // This should never happen if `authenticate` ran first, but guard anyway.
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    return next();
  };
}
