# Database

PostgreSQL + Prisma. The full schema is in `prisma/schema.prisma`. This document
summarizes the models, relations, and the reasoning behind key decisions.

## Conventions

- **UUID** primary keys (`gen_random_uuid()`), exposed safely in URLs.
- **Decimal** for all money (`price`, `amount`) — never Float.
- **Separate translation tables** for multilingual content (locales: `tj`, `ru`, `en`).
- **Soft delete** via `deletedAt` on `shops` and `products`.
- **Secrets stored hashed** — refresh tokens and reset tokens keep only a SHA-256 hash.
- Indexes on all foreign keys and common filter columns (status, deletedAt, ...).

## Core models

### User
`id, name, email?, phone?, passwordHash, role, status, timestamps`
- Either `email` or `phone` is required (enforced in validation).
- `role`: `CUSTOMER | SELLER | ADMIN | SUPER_ADMIN`.
- `status`: `ACTIVE | SUSPENDED | DELETED`.
- Relations: shop memberships, refresh tokens, password-reset tokens, audit logs.

### RefreshToken
`id, userId, tokenHash (unique), userAgent?, ipAddress?, expiresAt, revokedAt?, replacedBy?, createdAt`
- One row per active session. Only the **hash** is stored.
- Rotation: on refresh, the old row is revoked and `replacedBy` references the
  new token's hash.

### PasswordResetToken
`id, userId, tokenHash (unique), expiresAt, usedAt?, createdAt`
- Prepared for password recovery; only the hash is stored.

## Shops

### Shop
`id, slug (unique), phone?, status, sectionId?, timestamps, deletedAt?`
- `status`: `PENDING | APPROVED | REJECTED | SUSPENDED`.
- Belongs to an optional `Section` (its location on the map).
- Soft-deletable.

### ShopTranslation
`id, shopId, locale, name, description?` — unique `(shopId, locale)`.

### ShopMember
`id, userId, shopId, role, createdAt` — unique `(userId, shopId)`.
- `role`: `OWNER | MANAGER | STAFF`.
- Drives ownership/authorization. A user can belong to multiple shops.

## Categories

### Category (self-referencing tree)
`id, slug (unique), parentId?, status, timestamps`
- `status`: `ACTIVE | ARCHIVED`.
- `parent` / `children` form the category tree.

### CategoryTranslation
`id, categoryId, locale, name, description?` — unique `(categoryId, locale)`.

## Products

### Product
`id, shopId, categoryId?, price (Decimal 12,2), currency, status, availability, timestamps, deletedAt?`
- `status`: `PENDING | APPROVED | REJECTED | ARCHIVED`.
- `availability`: `IN_STOCK | OUT_OF_STOCK | PREORDER`.
- Soft-deletable.

### ProductTranslation
`id, productId, locale, name, description?` — unique `(productId, locale)`.

### ProductImage
`id, productId, imageUrl, storageKey, altText?, sortOrder, createdAt`
- `storageKey` is the object path in storage (used to delete the real file).

## Market map

### Gate
`id, code (unique), latitude?, longitude?, status, timestamps`
- Coordinates optional until verified (never invented).

### GateTranslation
`id, gateId, locale, name` — unique `(gateId, locale)`.

### Section
`id, gateId, code (unique), latitude?, longitude?, status, timestamps`
- Belongs to a Gate; shops belong to a Section.

### SectionTranslation
`id, sectionId, locale, name, description?` — unique `(sectionId, locale)`.

## Advertisements

### Advertisement
`id, shopId, title, imageUrl?, startDate, endDate, status, timestamps`
- `status`: `DRAFT | PENDING | ACTIVE | PAUSED | ENDED | REJECTED`.

## Subscriptions (B2B SaaS)

### Subscription
`id, shopId, planName, amount (Decimal), currency, billingPeriod, status, startsAt, expiresAt, timestamps`
- `status`: `ACTIVE | EXPIRED | CANCELLED`; `billingPeriod`: `MONTHLY | QUARTERLY | YEARLY`.
- Plans (Basic/Extended) are configurable via `SystemSetting` (`subscription_plans`).

### SubscriptionInvoice
`id, subscriptionId, amount, currency, status, periodStart, periodEnd, paidAt?, note?, createdAt`
- Manual payment tracking (`UNPAID | PAID | REFUNDED | VOID`) until a payment
  gateway is integrated.

## Audit & settings

### AuditLog
`id, userId?, action, entityType, entityId?, metadata (JSON)?, createdAt`
- Records sensitive actions. **No secrets** are ever stored in `metadata`.

### SystemSetting
`id, key (unique), value (JSON), updatedAt`
- Key/value store for configurable settings (SUPER_ADMIN managed).

## Migrations

- Dev: `npm run prisma:migrate` creates + applies a migration.
- Prod: `npm run prisma:deploy` applies committed migrations.
- The first migration (`prisma/migrations/*_init`) creates all tables above.

## Search & scaling

Current search uses case-insensitive `contains` matches against translation
names. Because searching lives behind the `search` service, it can later be
upgraded to PostgreSQL **full-text search** or the **pg_trgm** extension (for
fuzzy matching) without changing any callers. Suggested future indexes:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_product_tr_name_trgm ON product_translations USING gin (name gin_trgm_ops);
CREATE INDEX idx_shop_tr_name_trgm   ON shop_translations    USING gin (name gin_trgm_ops);
```
