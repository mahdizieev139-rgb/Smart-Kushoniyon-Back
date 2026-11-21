/**
 * Auth service — all authentication business logic lives here.
 *
 * Controllers stay thin: they parse the request, call these functions, and send
 * the response. This separation (controller vs service) keeps logic testable
 * and reusable.
 *
 * Token strategy (see utils/tokens.ts for the "why"):
 *   - access token  = short-lived JWT returned in the JSON body
 *   - refresh token = long-lived random string; we store only its HASH in the
 *     DB and send the RAW value to the client in an HttpOnly cookie.
 */
import type { User } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ApiError } from '../../utils/api-error';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  signAccessToken,
  createRefreshToken,
  hashToken,
  durationToMs,
} from '../../utils/tokens';
import type { LoginInput, RegisterInput } from './auth.validation';
import { auditLogService } from '../audit-logs/audit-log.service';

// Extra request context we record on each session for security/audit.
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

// The user shape we are safe to send to clients (never includes passwordHash).
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role' | 'status' | 'createdAt'>;

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

/**
 * Create an access token and a fresh refresh-token session row.
 * Returns the raw refresh token (for the cookie) and its expiry.
 */
async function issueSession(user: Pick<User, 'id' | 'role'>, ctx: SessionContext) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });

  const { raw, hash } = createRefreshToken();
  const expiresAt = new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: raw, refreshExpiresAt: expiresAt };
}

export async function registerUser(input: RegisterInput, ctx: SessionContext) {
  // Ensure the email/phone is not already taken (friendly 409 instead of a
  // raw DB error). We check both because either can be the unique identifier.
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict('An account with this email already exists');
  }
  if (input.phone) {
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) throw ApiError.conflict('An account with this phone already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      passwordHash,
      role: input.role, // CUSTOMER or SELLER only (enforced by the schema)
    },
  });

  const session = await issueSession(user, ctx);

  // Audit the registration (no secrets in metadata).
  await auditLogService.record({
    userId: user.id,
    action: 'USER_REGISTERED',
    entityType: 'User',
    entityId: user.id,
    metadata: { role: user.role },
  });

  return { user: toPublicUser(user), ...session };
}

export async function loginUser(input: LoginInput, ctx: SessionContext) {
  // Find the user by whichever identifier was provided.
  const user = input.email
    ? await prisma.user.findUnique({ where: { email: input.email } })
    : await prisma.user.findUnique({ where: { phone: input.phone! } });

  // Use the SAME error for "no user" and "wrong password" so attackers cannot
  // tell which emails/phones are registered (prevents user enumeration).
  if (!user) throw ApiError.unauthorized('Invalid credentials');

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) throw ApiError.unauthorized('Invalid credentials');

  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Your account is not active. Please contact support.');
  }

  const session = await issueSession(user, ctx);

  await auditLogService.record({
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user.id,
  });

  return { user: toPublicUser(user), ...session };
}

/**
 * Rotate a refresh token: validate the incoming one, revoke it, and issue a new
 * session. Rotation means a stolen refresh token is only usable until the real
 * user next refreshes (which invalidates the stolen copy).
 */
export async function refreshSession(rawToken: string | undefined, ctx: SessionContext) {
  if (!rawToken) throw ApiError.unauthorized('Missing refresh token');

  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  // Reject unknown, revoked, or expired tokens.
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Invalid or expired session');
  }
  if (stored.user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Your account is not active');
  }

  // Issue the new session first, then mark the old token as replaced.
  const session = await issueSession(stored.user, ctx);
  const newHash = hashToken(session.refreshToken);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedBy: newHash },
  });

  return { user: toPublicUser(stored.user), ...session };
}

/** Revoke the given refresh token (logout). Safe to call even if unknown. */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Return the current authenticated user's public profile. */
export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User');
  return toPublicUser(user);
}
