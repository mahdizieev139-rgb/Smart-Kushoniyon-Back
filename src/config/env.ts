/**
 * Environment configuration.
 *
 * We load the .env file and validate every variable with Zod BEFORE the app
 * starts. If something required is missing or malformed, the process exits
 * immediately with a clear message — much better than a confusing crash later.
 */
import 'dotenv/config';
import { z } from 'zod';

// Helper: a string that must look like a positive integer, parsed to a number.
const numericString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? defaultValue : Number(value)))
    .pipe(z.number().int().positive());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: numericString(4000),
    API_PREFIX: z.string().default('/api/v1'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters'),
    REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    // Comma-separated list -> string[]. Empty entries are dropped.
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),

    REFRESH_COOKIE_NAME: z.string().default('kushoniyon_rt'),
    COOKIE_SECURE: z
      .string()
      .default('false')
      .transform((value) => value.toLowerCase() === 'true'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('uploads'),
    LOCAL_STORAGE_PUBLIC_URL: z.string().default('http://localhost:4000/uploads'),

    STORAGE_ENDPOINT: z.string().optional().default(''),
    STORAGE_REGION: z.string().default('us-east-1'),
    STORAGE_BUCKET: z.string().optional().default(''),
    STORAGE_ACCESS_KEY: z.string().optional().default(''),
    STORAGE_SECRET_KEY: z.string().optional().default(''),
    STORAGE_PUBLIC_URL: z.string().optional().default(''),

    MAX_UPLOAD_SIZE_BYTES: numericString(5 * 1024 * 1024),

    RATE_LIMIT_WINDOW_MS: numericString(15 * 60 * 1000),
    RATE_LIMIT_MAX: numericString(300),
    AUTH_RATE_LIMIT_WINDOW_MS: numericString(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: numericString(20),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  // When using the S3 driver, the S3 connection details must be present.
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      const required: Array<keyof typeof env> = [
        'STORAGE_ENDPOINT',
        'STORAGE_BUCKET',
        'STORAGE_ACCESS_KEY',
        'STORAGE_SECRET_KEY',
      ];
      for (const key of required) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=s3`,
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print a readable list of problems and stop. We do this here (not via the
  // logger) because the logger itself may depend on env values.
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
