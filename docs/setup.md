# Setup Guide

This guide walks you from a fresh clone to a running API, step by step.

## Prerequisites

- **Node.js >= 20** (we tested on Node 24)
- **PostgreSQL >= 14** running and reachable
- **npm** (comes with Node)

Check your versions:

```bash
node --version
npm --version
psql --version
```

## 1. Install dependencies

```bash
npm install
```

This also generates the Prisma client via the `postinstall`/`prisma generate`
step. If you ever change `prisma/schema.prisma`, run `npm run prisma:generate`.

## 2. Create the environment file

```bash
cp .env.example .env
```

Open `.env` and set at least:

- `DATABASE_URL` — your PostgreSQL connection string.
- `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` — long random strings
  (min 32 chars). Generate them:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

Every variable is documented in [environment.md](environment.md). The server
**validates** these at startup and refuses to start if any required value is
missing or malformed.

## 3. Create the database

Using `psql`:

```sql
CREATE DATABASE kushoniyon;
```

(Optionally create a separate test DB: `CREATE DATABASE kushoniyon_test;`)

## 4. Apply the schema (run migrations)

Development (creates a migration and applies it):

```bash
npm run prisma:migrate
```

Production (applies existing migrations, no prompts):

```bash
npm run prisma:deploy
```

## 5. Create the first SUPER_ADMIN (securely)

We never hardcode a production admin password. The bootstrap account is created
from environment variables:

```bash
# set these in .env first (use a STRONG password in real environments)
# SUPER_ADMIN_NAME=...
# SUPER_ADMIN_EMAIL=...
# SUPER_ADMIN_PASSWORD=...

npm run create:superadmin
```

This command is **idempotent** — running it again updates the existing account
instead of creating a duplicate.

## 6. (Optional) Seed DEMO data

```bash
npm run db:seed
```

This inserts clearly-labeled **DEMO** categories, a gate/section (coordinates
left `null`, never invented), a demo approved shop, and demo products. It also
ensures the SUPER_ADMIN exists. Demo logins (password `Demo1234!`):

- `admin@kushoniyon.local` (ADMIN)
- `seller@kushoniyon.local` (SELLER)
- `customer@kushoniyon.local` (CUSTOMER)

## 7. Run the server

```bash
npm run dev     # development, auto-reload
# or
npm run build && npm start   # production build + run
```

Visit `http://localhost:4000/api/v1/health` — you should see a healthy response.

---

## Tests

Tests use a **separate** database so they never touch your dev data. The test
database URL and secrets are defined in `vitest.config.ts`
(`kushoniyon_test` by default).

First-time test DB setup:

```bash
# create the DB
psql -c "CREATE DATABASE kushoniyon_test"
# apply the schema to it
DATABASE_URL="postgresql://USER:PASS@localhost:5432/kushoniyon_test?schema=public" npm run prisma:deploy
```

Then run:

```bash
npm test
```

Each test truncates all tables before it runs, so tests are independent.

---

## Troubleshooting

- **"Invalid environment configuration"** on startup → a required `.env` value is
  missing/short. Read the printed list and fix `.env`.
- **Cannot connect to database** → check `DATABASE_URL`, that PostgreSQL is
  running, and that the database exists.
- **Prisma client out of date** → run `npm run prisma:generate`.
- **CORS errors from the frontend** → add the frontend origin to `CORS_ORIGINS`.
