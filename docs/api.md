# API Reference

Base URL: `/api/v1`

## Response format

Every response uses one of these envelopes.

**Success**
```json
{ "success": true, "message": "Product created successfully", "data": { } }
```

Paginated success adds `meta`:
```json
{ "success": true, "message": "Products", "data": [ ], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

**Error**
```json
{ "success": false, "message": "Validation failed", "errors": [ { "field": "email", "message": "Invalid email" } ] }
```

## Common conventions

- **Auth**: send `Authorization: Bearer <accessToken>`.
- **Locale**: many read endpoints accept `?locale=tj|ru|en` (default `tj`).
  Responses include `translations` (all locales) plus a resolved `name` /
  `description` for the requested locale.
- **Pagination**: `?page=1&limit=20` (limit max 100).
- **IDs** are UUIDs.

Legend: 🔓 public · 🔑 authenticated · 🏪 seller/owner · 🛡️ admin · 👑 super-admin

---

## Auth — `/auth`

| Method | Path         | Access | Description                                   |
| ------ | ------------ | ------ | --------------------------------------------- |
| POST   | `/register`  | 🔓     | Register (CUSTOMER or SELLER). Returns `{ user, accessToken }`, sets refresh cookie. |
| POST   | `/login`     | 🔓     | Login with email **or** phone + password.     |
| POST   | `/refresh`   | 🔓*    | Rotate refresh token (cookie), get new access token. |
| POST   | `/logout`    | 🔓*    | Revoke the current session, clear the cookie. |
| GET    | `/me`        | 🔑     | Current user profile.                         |

\* uses the HttpOnly refresh cookie, not a Bearer token.

Register/Login body:
```json
{ "name": "Ali", "email": "ali@example.com", "phone": "+992900000000", "password": "Password123!", "role": "SELLER" }
```
(`name`+`password` required; at least one of `email`/`phone`; `role` optional.)

---

## Shops — `/shops`

| Method | Path                         | Access | Description                                 |
| ------ | ---------------------------- | ------ | ------------------------------------------- |
| GET    | `/`                          | 🔓     | List APPROVED shops. Filters: `q, sectionId, categoryId, sort, page, limit, locale`. |
| GET    | `/:id`                       | 🔓     | Get shop by id (pending shops only visible to members/admins). |
| GET    | `/slug/:slug`                | 🔓     | Get shop by slug.                           |
| POST   | `/`                          | 🏪     | Create shop (starts **PENDING**). Creator becomes OWNER. |
| PATCH  | `/:id`                       | 🏪     | Update own shop (translations, phone, section). |
| DELETE | `/:id`                       | 🏪     | Soft-delete own shop.                       |
| GET    | `/:id/members`               | 🏪     | List shop members.                          |
| POST   | `/:id/members`               | 🏪     | Add a member `{ userId, role }`.            |
| DELETE | `/:id/members/:memberId`     | 🏪     | Remove a member (cannot remove last owner). |

Create body:
```json
{ "translations": [ { "locale": "tj", "name": "Мағоза", "description": "..." } ], "phone": "+992...", "sectionId": "uuid" }
```

---

## Products — `/products`

| Method | Path                       | Access | Description                                     |
| ------ | -------------------------- | ------ | ----------------------------------------------- |
| GET    | `/`                        | 🔓     | List APPROVED products. Filters: `q, shopId, categoryId, availability, minPrice, maxPrice, sort, page, limit, locale`. |
| GET    | `/:id`                     | 🔓     | Get product (pending only visible to members/admins). |
| POST   | `/`                        | 🏪     | Create product (starts **PENDING**).            |
| PATCH  | `/:id`                     | 🏪     | Update own product.                             |
| DELETE | `/:id`                     | 🏪     | Soft-delete (archive) own product.              |
| GET    | `/:id/images`              | 🔓     | List product images.                            |
| POST   | `/:id/images`              | 🏪     | Upload images (multipart, field `images`, up to 10). |
| DELETE | `/:id/images/:imageId`     | 🏪     | Delete an image.                                |

Create body:
```json
{ "shopId": "uuid", "categoryId": "uuid", "price": 45.50, "currency": "TJS", "availability": "IN_STOCK",
  "translations": [ { "locale": "tj", "name": "Кошин", "description": "..." } ] }
```
`sort`: `newest | oldest | price_asc | price_desc`. Prices returned as 2-decimal strings (`"45.50"`).

---

## Categories — `/categories`

| Method | Path     | Access | Description                                   |
| ------ | -------- | ------ | --------------------------------------------- |
| GET    | `/`      | 🔓     | List ACTIVE categories. Filters: `parentId, locale, page, limit`. |
| GET    | `/:id`   | 🔓     | Get category (with children).                 |
| POST   | `/`      | 🛡️/👑  | Create category.                              |
| PATCH  | `/:id`   | 🛡️/👑  | Update category (translations, parent, status, slug). |
| DELETE | `/:id`   | 🛡️/👑  | Delete (archives instead if it has children/products). |

---

## Market map — `/market-map`, `/gates`, `/sections`

| Method | Path                    | Access | Description                                        |
| ------ | ----------------------- | ------ | -------------------------------------------------- |
| GET    | `/market-map`           | 🔓     | Full map: active gates → sections (+ approved shop counts). |
| GET    | `/gates`                | 🔓     | List active gates.                                 |
| GET    | `/gates/:id`            | 🔓     | Get gate.                                          |
| POST   | `/gates`                | 🛡️/👑  | Create gate.                                       |
| PATCH  | `/gates/:id`            | 🛡️/👑  | Update gate.                                        |
| DELETE | `/gates/:id`            | 🛡️/👑  | Delete gate (blocked if it has sections).          |
| GET    | `/sections`             | 🔓     | List active sections. Filter: `gateId`.            |
| GET    | `/sections/:id`         | 🔓     | Get section.                                        |
| GET    | `/sections/:id/shops`   | 🔓     | Approved shops in a section.                        |
| POST   | `/sections`             | 🛡️/👑  | Create section.                                     |
| PATCH  | `/sections/:id`         | 🛡️/👑  | Update section.                                     |
| DELETE | `/sections/:id`         | 🛡️/👑  | Delete section (blocked if it has shops).          |

> Coordinates (`latitude`/`longitude`) are optional and `null` until verified.

---

## Search — `/search`

| Method | Path   | Access | Description                                                     |
| ------ | ------ | ------ | -------------------------------------------------------------- |
| GET    | `/`    | 🔓     | Global search. Returns only approved/active records.           |

Query: `q` (required), `type=all|shops|products|categories|sections`, `locale`,
`page`, `limit`, `categoryId`, `shopId`, `sectionId`, `minPrice`, `maxPrice`,
`sort=newest|price_asc|price_desc`.

Response `data`:
```json
{ "results": { "shops": [], "products": [], "categories": [], "sections": [] },
  "counts":  { "shops": 0,  "products": 0,  "categories": 0,  "sections": 0 } }
```

---

## Advertisements — `/advertisements`

| Method | Path            | Access | Description                                           |
| ------ | --------------- | ------ | ----------------------------------------------------- |
| GET    | `/`             | 🔓     | Currently ACTIVE ads (within their date window).      |
| GET    | `/manage`       | 🏪/🛡️  | Managed listing (sellers see own; admins see all).    |
| GET    | `/:id`          | 🔓     | Get advertisement.                                    |
| POST   | `/`             | 🏪     | Create ad (starts DRAFT).                             |
| PATCH  | `/:id`          | 🏪     | Update ad.                                            |
| PATCH  | `/:id/status`   | 🏪/🛡️  | Lifecycle: `{ "action": "submit\|activate\|pause\|end" }` (owner) or `approve\|reject` (admin). |

---

## Seller — `/seller`

| Method | Path          | Access | Description                                        |
| ------ | ------------- | ------ | -------------------------------------------------- |
| GET    | `/dashboard`  | 🏪     | Stats for the seller's own shops only.             |
| GET    | `/shops`      | 🏪     | The seller's own shops.                            |
| GET    | `/products`   | 🏪     | The seller's own products.                         |

---

## Admin — `/admin`

All require authentication. Role noted per row (🛡️ admin+super, 👑 super only).

| Method | Path                          | Access | Description                               |
| ------ | ----------------------------- | ------ | ----------------------------------------- |
| GET    | `/analytics`                  | 🛡️     | Market-wide statistics.                   |
| GET    | `/shops`                      | 🛡️     | List shops (any status).                  |
| PATCH  | `/shops/:id/approve`          | 🛡️     | Approve shop.                             |
| PATCH  | `/shops/:id/reject`           | 🛡️     | Reject shop `{ reason? }`.                |
| PATCH  | `/shops/:id/suspend`          | 🛡️     | Suspend shop `{ reason? }`.              |
| GET    | `/products`                   | 🛡️     | List products (any status).               |
| PATCH  | `/products/:id/approve`       | 🛡️     | Approve product.                          |
| PATCH  | `/products/:id/reject`        | 🛡️     | Reject product `{ reason? }`.            |
| GET    | `/users`                      | 🛡️     | List users. Filters: `role, status, q`.   |
| GET    | `/users/:id`                  | 🛡️     | Get a user.                               |
| PATCH  | `/users/:id`                  | 🛡️     | Update user status/name (role change 👑). |
| POST   | `/users`                      | 👑     | Create an admin account.                  |
| GET    | `/subscription-plans`         | 🛡️     | List configurable plans.                  |
| PUT    | `/subscription-plans`         | 👑     | Replace plans (JSON array).               |
| GET    | `/subscriptions`              | 👑     | List subscriptions.                       |
| GET    | `/subscriptions/:id`          | 👑     | Get a subscription (with invoices).       |
| POST   | `/subscriptions`              | 👑     | Create a subscription.                    |
| PATCH  | `/subscriptions/:id`          | 👑     | Update a subscription.                    |
| PATCH  | `/subscriptions/:id/invoice`  | 👑     | Record invoice status `{ status, note? }`.|
| GET    | `/settings`                   | 👑     | List system settings.                     |
| GET    | `/settings/:key`              | 👑     | Get a setting.                            |
| PUT    | `/settings`                   | 👑     | Upsert a setting `{ key, value }`.        |
| DELETE | `/settings/:key`              | 👑     | Delete a setting.                         |
| GET    | `/audit-logs`                 | 👑     | List audit logs. Filters: `entityType, action, userId`. |

Create subscription body:
```json
{ "shopId": "uuid", "planName": "Basic", "amount": 1500, "currency": "TJS", "billingPeriod": "MONTHLY" }
```

---

## Health

| Method | Path       | Access | Description          |
| ------ | ---------- | ------ | -------------------- |
| GET    | `/health`  | 🔓     | Liveness check.      |

---

## Status codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 200  | OK                                       |
| 201  | Created                                  |
| 400  | Validation / bad request                 |
| 401  | Not authenticated / invalid token        |
| 403  | Authenticated but not allowed (role/ownership) |
| 404  | Not found                                |
| 409  | Conflict (duplicate)                     |
| 429  | Too many requests (rate limited)         |
| 500  | Unexpected server error                  |
