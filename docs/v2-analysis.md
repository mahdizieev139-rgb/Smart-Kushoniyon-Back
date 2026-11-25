# KUSHONIYON SMART MARKET — Backend v2.0 Analysis Report (Stage 1)

_Analysis only. No code was changed in this stage._

Baseline verified on 2026-11-23: `npx tsc --noEmit` passes, 18 modules, 20 Prisma
models, 1 migration (`20261120152848_init`), 5 test files, local dev + test
databases migrated.

---

## 1. Completed functionality (working, preserve)

| Area | Status | Notes |
| ---- | ------ | ----- |
| Auth (register/login/refresh/logout/me) | ✅ | JWT access + rotating refresh (HttpOnly cookie, hash-only in DB), Argon2id |
| RBAC + ownership | ✅ | `authorize()` + service-layer `assertShopAccess()` |
| User management | ✅ | admin list/get/update, super-admin create-admin + role change |
| Shops + shop-members | ✅ | create (PENDING), approve/reject/suspend, soft delete, members CRUD |
| Products + images | ✅ | create (PENDING), approve/reject, soft delete, image upload (local/S3) |
| Categories (tree) | ✅ | multilingual, archive-on-dependents |
| Gates / Sections / Market map | ✅ | multilingual, optional coords (never invented), map aggregation |
| Search | ✅ | shops/products/categories/sections, price filter, pagination |
| Seller dashboard + analytics | ✅ | scoped to own shops (count-based) |
| Admin analytics + audit logs | ✅ | market-wide counts; audit on sensitive actions |
| Infra | ✅ | Helmet, CORS allowlist, rate limiting, Zod validation, central error handler, Pino |

## 2. Incomplete functionality (relative to v2 requirements)

- **Inventory**: `Product.availability` exists but there is **no** `stockQuantity`,
  `stockUnit`, or `lastStockUpdate`, and the availability enum lacks
  `LIMITED_STOCK` / `UNKNOWN`. No seller endpoint dedicated to stock updates.
- **Seller analytics**: currently count-based only — **no view tracking**
  (no `ProductView` / `ShopView`, no "most viewed", no "total views").
- **Search**: does not search by `brand`, `gate`, `section`, or `shopNumber`,
  and has no "recently updated" sort.
- **Market map**: no schematic (indoor) position fields, no shop/row numbers,
  no explicit `isDemo` flag (demo is only implied by `demo-` slug prefixes).
- **Product comparison**: not implemented — and products have no `brand` or
  structured `attributes`, which comparison needs to avoid false matches.

## 3. Missing modules (to add — all additive)

`price-comparison`, `price-history`, `favorites`, `notifications`,
`inquiries`, `seller-analytics` (view tracking). The construction calculator
stays on the frontend; backend only needs accurate units/specs (covered by the
inventory + attributes work).

## 4. Database observations

- Schema is clean, normalized, UUID PKs, `Decimal` money, indexed FKs. No
  structural problems.
- All v2 changes are **additive** (new models, new nullable columns, new enum
  values) → safe migrations, **no data loss, no schema reset**.
- Planned new models: `ProductPriceHistory`, `FavoriteProduct`, `FavoriteShop`,
  `ProductView`, `ShopView`, `Notification`, `Inquiry`, `InquiryMessage`.
- Planned new fields: `Product.stockQuantity? / stockUnit? / lastStockUpdate? /
  brand? / attributes(Json)?`; `Shop.shopNumber?`; `Gate/Section` schematic
  position (`posX? / posY?`) + `isDemo Boolean @default(false)`.
- Enum additions: `ProductAvailability += LIMITED_STOCK, UNKNOWN` (keep existing
  values — removing `PREORDER` would be a non-additive change); new enums
  `NotificationType`, `InquiryStatus`.

## 5. API observations

- Consistent `{ success, message, data, meta? }` envelope — reuse everywhere.
- New endpoints slot under existing resources without breaking the contract:
  `/products/:id/compare`, `/products/:id/price-history`,
  `/products/:id/stock` (PATCH), `/favorites/*`, `/notifications/*`,
  `/inquiries/*`, `/seller/analytics*`.
- No existing endpoints need renaming. `docs/api.md` will be extended per
  endpoint (method, auth, role, params, body, responses, pagination).

## 6. Security observations

- Foundations are solid. New modules must add ownership checks:
  favorites/notifications are per-user; inquiries are visible only to the owning
  customer and the target shop's members; stock updates reuse `assertShopAccess`.
- View tracking must **not** store customer PII and must be written cheaply
  (deduped) to avoid write amplification and abuse.
- Keep "never trust client-supplied userId/role/ownership" — all enforced server-side.

## 7. ⚠️ Conflict to resolve before Stage 2

v2 §2 says **"Do not implement paid subscriptions, payment processing, pricing
plans, or monetization features."** The v1 backend already contains a
`subscriptions` module (`Subscription` + `SubscriptionInvoice` models, configurable
Basic/Extended plans, `/admin/subscriptions*`). It does manual invoice tracking
only (no payment gateway), but it *is* a paid-subscription/pricing feature.

This is a decision for the owner (see chat). Options: keep as-is, unmount the
routes but keep the tables (dormant, no data loss), or remove the module.
No action taken until confirmed.

## 8. Recommended implementation order

Matches the v2 staged workflow; each stage is self-contained, additive, and
ends with typecheck + tests:

1. **Stage 2** — Resolve the subscriptions decision; no other critical bugs found.
2. **Stage 3** — Inventory fields + enum values + seller stock endpoint; Price history (`ProductPriceHistory`, recorded on price change inside the product-update transaction).
3. **Stage 4** — Product comparison (`/products/:id/compare`) using category + brand + unit/attributes, not name alone.
4. **Stage 5** — Favorites (products + shops), per-user.
5. **Stage 6** — Market map schematic fields + shop/row numbers + `isDemo`.
6. **Stage 7** — Seller analytics with `ProductView` / `ShopView` tracking.
7. **Stage 8** — Notifications (incl. favorite price-change / back-in-stock events).
8. **Stage 9** — Customer–seller inquiries.
9. **Stage 10** — Tests, security review, `docs/api.md` completion.
