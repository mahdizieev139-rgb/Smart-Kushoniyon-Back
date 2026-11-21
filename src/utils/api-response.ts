/**
 * Helpers that build our consistent API response shape.
 *
 * Every endpoint returns the same envelope so the frontend can rely on it:
 *   success: { success: true, message, data }
 *   error:   { success: false, message, errors }
 */
import type { Response } from 'express';

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: Meta,
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): Response {
  return sendSuccess(res, data, message, 201);
}
