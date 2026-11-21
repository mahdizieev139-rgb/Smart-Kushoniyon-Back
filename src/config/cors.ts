/**
 * CORS configuration.
 *
 * Only origins listed in CORS_ORIGINS (the allowlist) may call the API with
 * credentials (cookies). Requests with no Origin header (e.g. curl, server to
 * server, health checks) are allowed through.
 */
import type { CorsOptions } from 'cors';
import { env } from './env';
import { logger } from './logger';

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Non-browser clients (no Origin) are allowed.
    if (!origin) return callback(null, true);

    if (env.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    logger.warn({ origin }, 'Blocked by CORS allowlist');
    return callback(new Error('Not allowed by CORS'));
  },
  // Required so the browser sends/receives the HttpOnly refresh-token cookie.
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
