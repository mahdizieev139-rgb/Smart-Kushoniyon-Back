/**
 * Type augmentation: adds `req.user` to Express's Request type.
 *
 * The `authenticate` middleware attaches the current user here after verifying
 * the access token, so controllers can read `req.user` with full type safety.
 */
import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      role: UserRole;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
