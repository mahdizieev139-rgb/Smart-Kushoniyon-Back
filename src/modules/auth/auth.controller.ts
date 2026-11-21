/**
 * Auth controller — thin HTTP layer over the auth service.
 *
 * Responsibilities here:
 *   - read parsed request data
 *   - call the service
 *   - set/clear the refresh-token cookie
 *   - send the standard JSON response
 *
 * All real logic lives in auth.service.ts.
 */
import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { durationToMs } from '../../utils/tokens';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import * as authService from './auth.service';
import type { SessionContext } from './auth.service';

// Build the options for the HttpOnly refresh-token cookie. HttpOnly means
// JavaScript on the page cannot read it, which protects against XSS theft.
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE, // true in production (HTTPS only)
    sameSite: env.COOKIE_SAMESITE,
    maxAge: durationToMs(env.REFRESH_TOKEN_EXPIRES_IN),
    path: '/', // sent to every route; the server only reads it on auth routes
  };
}

// Collect request context (user agent + IP) to store on the session row.
function sessionContext(req: Request): SessionContext {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(env.REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

export async function register(req: Request, res: Response) {
  const result = await authService.registerUser(req.body, sessionContext(req));
  setRefreshCookie(res, result.refreshToken);
  // Never return the raw refresh token in the body — it lives in the cookie.
  return sendCreated(res, { user: result.user, accessToken: result.accessToken }, 'Registration successful');
}

export async function login(req: Request, res: Response) {
  const result = await authService.loginUser(req.body, sessionContext(req));
  setRefreshCookie(res, result.refreshToken);
  return sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Login successful');
}

export async function refresh(req: Request, res: Response) {
  const rawToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
  const result = await authService.refreshSession(rawToken, sessionContext(req));
  setRefreshCookie(res, result.refreshToken);
  return sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Token refreshed');
}

export async function logout(req: Request, res: Response) {
  const rawToken = req.cookies?.[env.REFRESH_COOKIE_NAME];
  await authService.logout(rawToken);
  res.clearCookie(env.REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
  return sendSuccess(res, null, 'Logged out');
}

export async function me(req: Request, res: Response) {
  // `authenticate` guarantees req.user exists before this runs.
  const user = await authService.getCurrentUser(req.user!.id);
  return sendSuccess(res, { user }, 'Current user');
}
