# Authentication & Authorization

## Token model

We use **two** token types:

1. **Access token** — a short-lived JWT (default 15 min). The client sends it on
   every request in the header:
   ```
   Authorization: Bearer <access token>
   ```
   It carries the user id (`sub`) and `role`.

2. **Refresh token** — a long-lived random string (default 30 days). The RAW
   value is stored in an **HttpOnly cookie** (JavaScript cannot read it). The
   database stores only its **SHA-256 hash**, so a DB leak cannot hand out usable
   tokens.

## Flow

```
register / login
   → creates a user session
   → returns { user, accessToken } in the body
   → sets the refresh token as an HttpOnly cookie

access token expires (15 min)
   → client calls POST /auth/refresh (cookie sent automatically)
   → server verifies + ROTATES the refresh token:
        old token revoked, new token issued (new cookie)
   → returns a fresh accessToken

logout
   → revokes the current refresh token and clears the cookie
```

### Refresh token rotation

On every refresh, the used token is revoked and replaced with a new one (its
`replacedBy` points at the replacement). This limits the damage of a stolen
refresh token: once the real user refreshes, the stolen copy stops working.

## Password storage

Passwords are hashed with **Argon2id** (memory-hard, modern). We never store or
return plaintext passwords or hashes. Login uses a constant generic error
(`Invalid credentials`) for both "no such user" and "wrong password" to avoid
revealing which accounts exist.

## Cookies in production

Set in `.env`:

```
COOKIE_SECURE=true          # HTTPS only
COOKIE_SAMESITE=lax         # or "none" for cross-site frontend over HTTPS
```

The frontend must call the API with credentials included
(`fetch(url, { credentials: 'include' })`) so the refresh cookie is sent, and its
origin must be in `CORS_ORIGINS`.

## Roles & permissions (RBAC)

| Role          | Can do                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| `CUSTOMER`    | Read approved shops/products/categories, market map, search.           |
| `SELLER`      | Customer actions + manage own shops/products/images + own stats.       |
| `ADMIN`       | Moderate shops/products, manage categories/gates/sections/ads, analytics. |
| `SUPER_ADMIN` | Admin actions + manage admins, subscriptions, settings, audit logs.    |

### How it is enforced

- **`authenticate`** middleware verifies the access token and attaches `req.user`.
- **`authorize(...roles)`** middleware checks the user's global role.
  SUPER_ADMIN is **not** auto-granted everywhere — routes list every role that is
  allowed, so access is obvious from the route definition.
- **Ownership checks** happen in the service layer. For example, a seller can
  only modify a product whose shop they are a member of
  (`assertShopAccess(userId, role, shopId)`). Admins bypass membership.

> The frontend must never be trusted for authorization. Every protected action
> is checked again on the backend, including ownership.

## Creating the first SUPER_ADMIN

Never hardcode a production admin password. Use:

```bash
npm run create:superadmin   # reads SUPER_ADMIN_* from the environment
```

Admin and super-admin accounts are **never** created via the public
`/auth/register` endpoint (it only allows `CUSTOMER` and `SELLER`). A SUPER_ADMIN
creates further admins via `POST /admin/users`.
