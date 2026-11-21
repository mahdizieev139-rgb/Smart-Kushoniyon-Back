import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration.
 *
 * We inject test-only environment variables here. Because these are set in
 * process.env BEFORE our code runs, and `dotenv` does NOT override existing
 * variables, these values win over `.env` during tests — so tests always use
 * the SEPARATE test database and never touch development/production data.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Run test files one at a time: they share one database and each file
    // cleans the tables, so parallel files would interfere with each other.
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/kushoniyon_test?schema=public',
      ACCESS_TOKEN_SECRET: 'test_access_secret_at_least_32_characters_long_xx',
      REFRESH_TOKEN_SECRET: 'test_refresh_secret_at_least_32_characters_long_x',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN: '30d',
      CORS_ORIGINS: 'http://localhost:3000',
      STORAGE_DRIVER: 'local',
      LOG_LEVEL: 'error',
      // High limits so rate limiting never interferes with the test suite.
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
    },
  },
});
