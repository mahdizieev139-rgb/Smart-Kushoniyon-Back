/**
 * Rate limiting — protects the API from brute-force and abuse.
 *
 * Two limiters:
 *   - apiLimiter:  a generous limit applied to all /api routes.
 *   - authLimiter: a strict limit applied to login/register/refresh, where
 *                  brute-force attempts are most likely.
 *
 * Limits are configurable via environment variables (see config/env.ts).
 */
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Shared JSON error shape so rate-limit responses match the rest of the API.
const message = { success: false, message: 'Too many requests, please try again later' };

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true, // return RateLimit-* headers
  legacyHeaders: false,
  message,
});

export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message,
});
