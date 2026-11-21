/**
 * authenticate — verifies the access token and attaches the user to req.user.
 *
 * The client sends `Authorization: Bearer <access token>`. We verify the JWT
 * signature and expiry, then store { id, role } on req.user for downstream
 * middleware/controllers. If the token is missing or invalid we throw 401.
 *
 * Note: we trust the signed token's role claim for authorization, but any
 * action that MUTATES data still re-checks ownership against the database
 * (never trust the client).
 */
import type { RequestHandler } from 'express';
import { ApiError } from '../utils/api-error';
import { verifyAccessToken } from '../utils/tokens';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token); // throws 401 if invalid/expired

  req.user = { id: payload.sub, role: payload.role };
  return next();
};

/**
 * optionalAuthenticate — like authenticate, but does NOT fail if no token is
 * present. Used by public endpoints that behave slightly differently when a
 * user happens to be logged in (e.g. returning extra fields).
 */
export const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Ignore a bad token on optional auth — treat the request as anonymous.
    }
  }
  return next();
};
