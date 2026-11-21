/**
 * Token utilities.
 *
 * Two different token types:
 *
 * 1. ACCESS token  — a short-lived JWT the client sends in the
 *    `Authorization: Bearer <token>` header on every request. It carries the
 *    user id and role so the API can authorize without a DB lookup.
 *
 * 2. REFRESH token — a long-lived RANDOM string (not a JWT) stored in an
 *    HttpOnly cookie. We keep only its SHA-256 HASH in the database. When the
 *    client asks for a new access token we hash the incoming token and look it
 *    up. Storing a hash means a database leak does not expose usable tokens.
 */
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { ApiError } from './api-error';

export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as jwt.JwtPayload;
    return { sub: String(decoded.sub), role: decoded.role as UserRole };
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
}

// Create a cryptographically-random refresh token (the raw value sent to the
// client) and its hash (what we store in the database).
export function createRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(48).toString('hex');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// Convert a duration string like "30d" / "15m" / "1h" into milliseconds,
// used to compute the refresh token's DB expiry and the cookie maxAge.
export function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    // Fallback: 30 days. Keeps the app running even on a misconfigured value.
    return 30 * 24 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * unitMs[unit];
}
