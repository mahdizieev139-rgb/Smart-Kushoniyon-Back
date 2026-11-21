# Security

A summary of the protections built into this backend and operational guidance.

## Application-level protections

| Measure                   | How / where                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| Secure HTTP headers       | `helmet()` in `app.ts`                                              |
| CORS allowlist            | `config/cors.ts` — only `CORS_ORIGINS` may use credentials         |
| Rate limiting             | `middlewares/rate-limit.ts` — general + stricter auth limiter      |
| Password hashing          | Argon2id (`utils/password.ts`)                                     |
| Access tokens             | Short-lived JWT; verified by `authenticate`                        |
| Refresh tokens            | Random, HttpOnly cookie, **hash-only** in DB, rotated on refresh   |
| Input validation          | Zod schemas on body/query/params (`middlewares/validate.ts`)       |
| Role-based authorization  | `authorize(...)` middleware                                        |
| Ownership checks          | Service layer (`assertShopAccess`) — never trust client user IDs   |
| Safe file uploads         | MIME allowlist, size cap, server-generated filenames (`upload.ts`, `storage.ts`) |
| SQL injection protection  | Prisma parameterizes all queries                                   |
| Env validation            | `config/env.ts` validates + fails fast on misconfiguration         |
| No secret leakage         | Error handler hides internals in production; logger redacts secrets |
| Request logging           | `pino-http` (authorization/cookie headers redacted)                |

## Secrets handling

- `.env` is **git-ignored**. Never commit real secrets.
- JWT secrets must be long random strings (min 32 chars, enforced).
- Audit logs **never** store passwords, tokens, or other secrets.
- API responses never include `passwordHash` or refresh tokens.

## File uploads

- Only `image/jpeg`, `image/png`, `image/webp`, `image/gif` are accepted.
- Size capped by `MAX_UPLOAD_SIZE_BYTES` (default 5 MB).
- The stored filename/extension is derived from the validated MIME type, not
  from the user's filename (prevents tricks like `evil.php.jpg`).
- Client-supplied storage paths are never trusted.

## Production checklist

- [ ] `NODE_ENV=production`
- [ ] `COOKIE_SECURE=true` and the API served over HTTPS
- [ ] Strong, unique `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET`
- [ ] `CORS_ORIGINS` restricted to your real frontend origin(s)
- [ ] A strong `SUPER_ADMIN_PASSWORD`, rotated after first login
- [ ] Run behind a reverse proxy (nginx) — `trust proxy` is already enabled
- [ ] Database not publicly exposed; least-privilege DB user
- [ ] Backups configured (see below)

## Database backups (recommended)

Automated backups are an operational task for the server owner. A simple daily
logical backup with `pg_dump`:

```bash
# daily backup (e.g. via cron)
pg_dump "$DATABASE_URL" -Fc -f "/backups/kushoniyon_$(date +%F).dump"

# restore
pg_restore --clean --if-exists -d "$DATABASE_URL" /backups/kushoniyon_YYYY-MM-DD.dump
```

Guidance:

- Keep at least 7 daily + 4 weekly backups off-box.
- Test a restore periodically — an untested backup is not a backup.
- Consider PITR (point-in-time recovery) via WAL archiving for production.

## Reporting

If you discover a vulnerability, contact the project owner privately rather than
opening a public issue.
