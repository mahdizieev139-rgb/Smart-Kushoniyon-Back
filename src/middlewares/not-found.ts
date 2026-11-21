/**
 * 404 handler — mounted AFTER all routes but BEFORE the error handler.
 *
 * If no route matched the request, we forward a NotFound ApiError to the
 * central error handler so the client gets our standard error envelope.
 */
import type { RequestHandler } from 'express';
import { ApiError } from '../utils/api-error';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl}`));
};
