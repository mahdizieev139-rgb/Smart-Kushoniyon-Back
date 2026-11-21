/**
 * Central error handler — the LAST middleware mounted on the app.
 *
 * Every thrown error (via asyncHandler -> next(err)) ends up here. We translate
 * it into our consistent JSON error envelope so the frontend always sees the
 * same shape: { success: false, message, errors? }.
 *
 * We handle three kinds of errors specially:
 *   1. ApiError            -> our own expected errors (correct status + message)
 *   2. ZodError            -> request validation failures (400 + field details)
 *   3. Prisma known errors -> e.g. unique constraint violation (409)
 * Anything else is treated as an unexpected 500 and the details are hidden
 * from the client (but logged), so we never leak internals.
 */
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/api-error';
import { logger } from '../config/logger';
import { isProduction } from '../config/env';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // 1. Our own operational errors.
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  // 2. Validation errors from Zod (thrown by the validate middleware).
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  // 3. Known Prisma errors we can map to friendly responses.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Unique constraint failed (e.g. email already used).
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return res.status(409).json({ success: false, message: `A record with this ${target} already exists` });
    }
    if (err.code === 'P2025') {
      // Record to update/delete not found.
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
  }

  // 4. Multer upload errors expose a `code` (e.g. file too large).
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File is too large' });
    }
    if (code === 'LIMIT_UNEXPECTED_FILE' || code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Too many or unexpected files' });
    }
  }

  // 5. Anything else is unexpected — log the full error, hide details.
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    // In development we expose the message to make debugging easier.
    ...(isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
  });
};
