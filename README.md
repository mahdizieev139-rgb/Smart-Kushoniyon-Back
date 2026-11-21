# KUSHONIYON SMART MARKET — Backend

Production-ready backend for **KUSHONIYON SMART MARKET**, a B2B SaaS marketplace
for Kushoniyon Market in Dushanbe, Tajikistan.

Built with **Node.js + Express + TypeScript + PostgreSQL (Prisma)**. It provides
authentication, role-based authorization, shop/product management with
multilingual content (Tajik / Russian / English), an interactive market-map API,
global search, advertisements, subscriptions, analytics, and audit logging.

> This repository is the **backend only**. The frontend (Next.js) lives
> separately. Deployment, hosting, domain and GitHub are configured manually by
> the project owner — nothing here deploys automatically.

---

## Tech stack

| Area            | Choice                                   |
| --------------- | ---------------------------------------- |
| Runtime         | Node.js (>= 20)                          |
| Framework       | Express 4 + TypeScript                   |
| Database        | PostgreSQL + Prisma ORM                  |
| Validation      | Zod                                      |
| Passwords       | Argon2id                                 |
| Auth            | JWT access tokens + rotating refresh tokens (HttpOnly cookie) |
| File storage    | S3-compatible abstraction (local adapter for dev) |
| Security        | Helmet, CORS allowlist, rate limiting    |
| Logging         | Pino (structured)                        |
| Tests           | Vitest + Supertest                       |

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file and fill it in
cp .env.example .env        # then edit .env (DATABASE_URL, secrets, ...)

# 3. Create the database (PostgreSQL must be running)
#    e.g. with psql:  CREATE DATABASE kushoniyon;

# 4. Apply the schema (creates tables)
npm run prisma:migrate      # development migration
npm run prisma:generate     # generate the Prisma client (usually automatic)

# 5. (Optional) Seed safe DEMO data + the first SUPER_ADMIN
npm run db:seed

# 6. Start the development server (auto-reload)
npm run dev
# API is now at http://localhost:4000/api/v1
```

Health check: `GET http://localhost:4000/api/v1/health`

---

## NPM scripts

| Script                        | What it does                                      |
| ----------------------------- | ------------------------------------------------- |
| `npm run dev`                 | Start the dev server with auto-reload (tsx)       |
| `npm run build`               | Compile TypeScript to `dist/`                     |
| `npm start`                   | Run the compiled server (`dist/src/server.js`)    |
| `npm run typecheck`           | Type-check without emitting files                 |
| `npm test`                    | Run the test suite once (Vitest)                  |
| `npm run test:watch`          | Run tests in watch mode                           |
| `npm run prisma:migrate`      | Create/apply a dev migration                      |
| `npm run prisma:deploy`       | Apply migrations in production                    |
| `npm run prisma:studio`       | Open Prisma Studio (DB GUI)                        |
| `npm run db:seed`             | Seed DEMO data + bootstrap SUPER_ADMIN            |
| `npm run create:superadmin`   | Create/update only the SUPER_ADMIN account        |

---

## Project structure

```
src/
├── config/        env validation, database, cors, storage, logger
├── middlewares/   authenticate, authorize, validate, error-handler, rate-limit, upload
├── modules/       one folder per business domain (controller/service/routes/validation)
├── routes/        combines all module routers under /api/v1
├── utils/         small reusable helpers (tokens, password, pagination, ...)
├── types/         shared TypeScript types + Express augmentation
├── app.ts         builds the Express app (no listening)
└── server.ts      starts the server + graceful shutdown
prisma/            schema.prisma, migrations, seed.ts
scripts/           create-super-admin.ts
tests/             Vitest + Supertest integration tests
docs/              detailed documentation (see below)
```

---

## Documentation

| Document                                  | Contents                                   |
| ----------------------------------------- | ------------------------------------------ |
| [docs/setup.md](docs/setup.md)            | Install, database, migrations, running     |
| [docs/environment.md](docs/environment.md)| Every environment variable explained       |
| [docs/architecture.md](docs/architecture.md)| How the code is organized and why        |
| [docs/database.md](docs/database.md)      | Data models, relations, indexes            |
| [docs/api.md](docs/api.md)                | Full REST endpoint reference               |
| [docs/authentication.md](docs/authentication.md)| Token flow, cookies, roles           |
| [docs/security.md](docs/security.md)      | Security measures + backup guidance        |
| [docs/deployment.md](docs/deployment.md)  | Building and running in production          |

---

## Roles at a glance

- **CUSTOMER** — browse approved shops, products, categories, market map.
- **SELLER** — everything a customer can do + manage their own shops/products/images and view their own stats.
- **ADMIN** — moderate shops/products (approve/reject), manage categories/gates/sections/advertisements, view market analytics.
- **SUPER_ADMIN** — everything an admin can do + manage admin accounts, subscriptions, system settings, and audit logs.

Authorization is **always enforced on the backend**, including resource
ownership checks (a seller can never touch another seller's data).

---

## Testing

```bash
npm test
```

Tests run against a **separate** test database (configured in `vitest.config.ts`)
and never touch development/production data. See [docs/setup.md](docs/setup.md#tests).

---

## License

Proprietary — all rights reserved by the project owner.
