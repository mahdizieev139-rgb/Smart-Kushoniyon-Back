# Environment Variables

All variables are validated at startup by `src/config/env.ts` (using Zod). If a
required value is missing or invalid, the server prints a clear error and exits.

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

## Core

| Variable      | Required | Default        | Description                                  |
| ------------- | -------- | -------------- | -------------------------------------------- |
| `NODE_ENV`    | no       | `development`  | `development` \| `test` \| `production`      |
| `PORT`        | no       | `4000`         | Port the HTTP server listens on              |
| `API_PREFIX`  | no       | `/api/v1`      | Base path for all routes                     |

## Database

| Variable        | Required | Description                                            |
| --------------- | -------- | ----------------------------------------------------- |
| `DATABASE_URL`  | **yes**  | PostgreSQL connection string (`postgresql://...`)     |

## Authentication / JWT

| Variable                   | Required | Default | Description                                   |
| -------------------------- | -------- | ------- | --------------------------------------------- |
| `ACCESS_TOKEN_SECRET`      | **yes**  | —       | Secret for signing access tokens (min 32 chars) |
| `REFRESH_TOKEN_SECRET`     | **yes**  | —       | Secret for refresh token hashing (min 32 chars) |
| `ACCESS_TOKEN_EXPIRES_IN`  | no       | `15m`   | Access token lifetime (`15m`, `1h`, ...)      |
| `REFRESH_TOKEN_EXPIRES_IN` | no       | `30d`   | Refresh token lifetime                        |

## Frontend / CORS / Cookies

| Variable            | Required | Default                 | Description                                        |
| ------------------- | -------- | ----------------------- | -------------------------------------------------- |
| `FRONTEND_URL`      | no       | `http://localhost:3000` | Primary frontend URL                               |
| `CORS_ORIGINS`      | no       | `http://localhost:3000` | Comma-separated allowlist of origins               |
| `REFRESH_COOKIE_NAME` | no     | `kushoniyon_rt`         | Name of the HttpOnly refresh cookie                |
| `COOKIE_SECURE`     | no       | `false`                 | `true` in production (HTTPS required)              |
| `COOKIE_SAMESITE`   | no       | `lax`                   | `lax` \| `strict` \| `none`                        |

> In production set `COOKIE_SECURE=true`. Use `COOKIE_SAMESITE=none` only when
> the frontend is on a different site and served over HTTPS.

## Object storage

| Variable                  | Required          | Default                          | Description                              |
| ------------------------- | ----------------- | -------------------------------- | ---------------------------------------- |
| `STORAGE_DRIVER`          | no                | `local`                          | `local` (dev) or `s3` (production)       |
| `LOCAL_STORAGE_DIR`       | no                | `uploads`                        | Folder for local files                   |
| `LOCAL_STORAGE_PUBLIC_URL`| no                | `http://localhost:4000/uploads`  | Public base URL for local files          |
| `STORAGE_ENDPOINT`        | if `s3`           | —                                | S3 endpoint URL                          |
| `STORAGE_REGION`          | no                | `us-east-1`                      | S3 region                                |
| `STORAGE_BUCKET`          | if `s3`           | —                                | Bucket name                              |
| `STORAGE_ACCESS_KEY`      | if `s3`           | —                                | Access key                               |
| `STORAGE_SECRET_KEY`      | if `s3`           | —                                | Secret key                               |
| `STORAGE_PUBLIC_URL`      | no                | —                                | Public/CDN base URL for stored files     |

When `STORAGE_DRIVER=s3`, the four S3 connection values are required (validated).

## Uploads

| Variable                | Required | Default         | Description                      |
| ----------------------- | -------- | --------------- | -------------------------------- |
| `MAX_UPLOAD_SIZE_BYTES` | no       | `5242880` (5MB) | Max size per uploaded image      |

## Rate limiting

| Variable                     | Required | Default           | Description                          |
| ---------------------------- | -------- | ----------------- | ------------------------------------ |
| `RATE_LIMIT_WINDOW_MS`       | no       | `900000` (15 min) | General window                       |
| `RATE_LIMIT_MAX`             | no       | `300`             | Max requests per window per IP       |
| `AUTH_RATE_LIMIT_WINDOW_MS`  | no       | `900000`          | Auth window                          |
| `AUTH_RATE_LIMIT_MAX`        | no       | `20`              | Max auth attempts per window per IP  |

## Logging

| Variable    | Required | Default | Description                                     |
| ----------- | -------- | ------- | ----------------------------------------------- |
| `LOG_LEVEL` | no       | `info`  | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace` |

## SUPER_ADMIN bootstrap

Used by `npm run create:superadmin` and `npm run db:seed`.

| Variable               | Required | Description                               |
| ---------------------- | -------- | ----------------------------------------- |
| `SUPER_ADMIN_NAME`     | no       | Display name                              |
| `SUPER_ADMIN_EMAIL`    | no       | Login email                               |
| `SUPER_ADMIN_PASSWORD` | no       | **Set a strong value** for real environments |
