# Deployment

> Nothing here deploys automatically. These are the manual steps the project
> owner follows on their own server/host.

## Build

```bash
npm ci                 # clean install from package-lock.json
npm run prisma:generate
npm run build          # compiles TypeScript to dist/
```

The compiled entry point is `dist/src/server.js` (also referenced by
`npm start`).

## Database migration (production)

Apply committed migrations (no prompts, no data loss from dev resets):

```bash
npm run prisma:deploy
```

Create the first admin once:

```bash
npm run create:superadmin   # reads SUPER_ADMIN_* from the environment
```

## Run

```bash
NODE_ENV=production npm start
```

Use a process manager so the app restarts on crash/reboot:

- **pm2**: `pm2 start dist/src/server.js --name kushoniyon-api`
- or a **systemd** service, or a **Docker** container.

## Reverse proxy (nginx) example

The app already calls `app.set('trust proxy', 1)` so `req.ip` and secure cookies
work behind a proxy. Terminate TLS at nginx and forward to the app:

```nginx
server {
  listen 443 ssl;
  server_name api.example.com;

  # ssl_certificate ...;  ssl_certificate_key ...;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Production environment

Set at minimum (see [environment.md](environment.md)):

```
NODE_ENV=production
DATABASE_URL=...                 # production database
ACCESS_TOKEN_SECRET=...          # strong, unique
REFRESH_TOKEN_SECRET=...         # strong, unique
CORS_ORIGINS=https://your-frontend.example.com
COOKIE_SECURE=true
COOKIE_SAMESITE=lax              # or "none" for cross-site HTTPS frontend
STORAGE_DRIVER=s3                # plus STORAGE_* values
```

## Object storage in production

Set `STORAGE_DRIVER=s3` and provide the `STORAGE_*` values (AWS S3, Cloudflare
R2, MinIO, etc.). The storage abstraction (`config/storage.ts`) handles the rest
— no code change needed to switch from the local dev adapter.

## Health & monitoring

- Liveness/health endpoint: `GET /api/v1/health`.
- Logs are structured JSON in production (pino) — ship them to your log system.

## Zero-downtime notes

- Run `prisma migrate deploy` as a separate step before swapping to the new
  build. Keep migrations backward-compatible when possible.
- With pm2, use `pm2 reload` for graceful restarts; the app handles SIGINT/SIGTERM
  by closing the HTTP server and the database connection cleanly.
