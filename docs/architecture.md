# Architecture

## Style: Modular Monolith

The backend is a **modular monolith**: one deployable application, organized
internally by **business domain**. Each domain is a self-contained module. This
gives us the simplicity of a single app with the clean boundaries of services —
and it can be split into microservices later if ever needed.

## Request lifecycle

```
HTTP request
   │
   ▼
Helmet (security headers)
   │
CORS (origin allowlist)
   │
Body + cookie parsers
   │
Request logging (pino-http)
   │
Rate limiting
   │
Router (/api/v1/...)
   │
route-level middleware:  authenticate → authorize → validate(Zod)
   │
Controller (thin: reads req, calls service, sends response)
   │
Service (business logic, DB via Prisma, ownership checks, audit log)
   │
Response envelope  { success, message, data, meta? }
   │
(on throw) Central error handler → { success:false, message, errors }
```

## Layers inside a module

Each module under `src/modules/<domain>/` typically contains:

| File                    | Responsibility                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| `*.validation.ts`       | Zod schemas describing valid request input                        |
| `*.service.ts`          | **All business logic**; the only layer that talks to the database |
| `*.controller.ts`       | Thin HTTP glue: read request → call service → send response       |
| `*.routes.ts`           | Maps HTTP paths to controllers + attaches middleware              |

**Controllers stay thin. Services hold the logic.** This separation makes the
logic easy to test (call the service directly) and keeps controllers readable.

## Why these choices (junior-friendly notes)

- **Translations in separate tables** (`*Translation`): content is multilingual
  (tj/ru/en). Keeping translations in their own tables keeps core tables clean
  and lets us add languages without schema changes.
- **UUID primary keys**: safe to expose in URLs, don't leak row counts.
- **Decimal for money**: floats cannot represent money exactly. We use
  `Decimal` and always format to 2 decimals in responses.
- **Soft deletes** (`deletedAt`): "deleting" a shop/product keeps the row for
  history and keeps related data valid; queries filter `deletedAt = null`.
- **Ownership checks in the service layer**: only the service knows which shop a
  product belongs to, so that is where we verify "can this user act on it?"
  (see `shop-members/shop-member.service.ts` → `assertShopAccess`).

## Shared building blocks

- `config/` — validated env, Prisma client (single shared instance), CORS,
  storage adapter, logger.
- `middlewares/` — `authenticate`, `authorize`, `validate`, `error-handler`,
  `rate-limit`, `upload`.
- `utils/` — `ApiError`, response helpers, pagination, password hashing, token
  helpers, slug + localization helpers.

## Modules

`auth`, `users`, `shops`, `shop-members`, `products`, `product-images`,
`categories`, `gates`, `sections`, `market-map`, `search`, `advertisements`,
`subscriptions`, `analytics`, `audit-logs`, `settings`, plus two aggregators:
`admin` (groups `/admin/*`) and `seller` (groups `/seller/*`).

## Error handling

Anywhere in a service/controller we `throw ApiError.notFound('Shop')` (or
`badRequest`, `forbidden`, `conflict`, ...). The `asyncHandler` wrapper forwards
it to the **central error handler**, which converts it to a consistent JSON
error with the right HTTP status. Unexpected errors are logged server-side and
returned as a generic 500 (no stack traces or secrets leak to clients).
