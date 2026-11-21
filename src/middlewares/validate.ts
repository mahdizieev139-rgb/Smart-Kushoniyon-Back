/**
 * Request validation middleware powered by Zod.
 *
 * You pass a schema describing the expected `body`, `query` and/or `params`.
 * If validation passes, the PARSED (and type-coerced) values replace the
 * originals so controllers receive clean, typed data. If it fails, the ZodError
 * is forwarded to the error handler, which returns a 400 with field details.
 *
 * Why replace req.query/req.body with parsed values? Because Zod can coerce
 * types (e.g. "2" -> 2) and strip unknown keys, so controllers never deal with
 * raw strings or unexpected fields.
 */
import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // req.query has only a getter in Express 5-style setups; assign safely.
        Object.defineProperty(req, 'query', { value: schemas.query.parse(req.query), writable: true });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}
