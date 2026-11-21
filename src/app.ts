/**
 * Express application assembly.
 *
 * We build and configure the app here but do NOT start listening — that is done
 * in server.ts. Keeping them separate makes the app easy to import in tests
 * (supertest) without opening a real network port.
 *
 * Middleware order matters and is intentional:
 *   1. security headers (helmet)
 *   2. CORS
 *   3. body + cookie parsers
 *   4. request logging
 *   5. rate limiting
 *   6. static files (local uploads in dev)
 *   7. API routes
 *   8. 404 handler
 *   9. central error handler (must be last)
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import path from 'path';
import { env } from './config/env';
import { corsOptions } from './config/cors';
import { logger } from './config/logger';
import { apiRouter } from './routes';
import { apiLimiter } from './middlewares/rate-limit';
import { notFoundHandler } from './middlewares/not-found';
import { errorHandler } from './middlewares/error-handler';

export function createApp() {
  const app = express();

  // Behind a reverse proxy (nginx) in production so req.ip is the real client.
  app.set('trust proxy', 1);

  // 1. Secure HTTP headers.
  app.use(helmet());

  // 2. CORS allowlist (needed for the cookie-based refresh flow).
  app.use(cors(corsOptions));

  // 3. Parsers. Limit JSON body size to reduce abuse.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // 4. Structured request logging.
  app.use(pinoHttp({ logger }));

  // 5. General rate limiting on all API routes.
  app.use(env.API_PREFIX, apiLimiter);

  // 6. Serve locally-stored uploads in development (S3 serves them in prod).
  if (env.STORAGE_DRIVER === 'local') {
    app.use('/uploads', express.static(path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR)));
  }

  // 7. API routes.
  app.use(env.API_PREFIX, apiRouter);

  // 8. Unknown route -> 404 in our standard shape.
  app.use(notFoundHandler);

  // 9. Central error handler (LAST).
  app.use(errorHandler);

  return app;
}
