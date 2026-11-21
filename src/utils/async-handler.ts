/**
 * asyncHandler wraps an async Express controller so that any thrown error (or
 * rejected promise) is forwarded to Express's error-handling middleware via
 * next(err). Without this, an async throw would become an unhandled rejection
 * and the request would hang.
 *
 * Usage:  router.get('/', asyncHandler(controller.list))
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncController): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
