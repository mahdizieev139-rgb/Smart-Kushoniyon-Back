/**
 * Structured logger (Pino).
 *
 * In development we pretty-print so logs are readable. In production we emit
 * JSON so log collectors (e.g. Loki, Datadog) can parse them.
 */
import pino from 'pino';
import { env, isProduction } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  // Never log these fields even if they appear in an object we pass in.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'accessToken',
    ],
    censor: '[REDACTED]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
});
