/**
 * ApiError — a typed error we throw anywhere in the app when something goes
 * wrong in an expected way (not found, forbidden, duplicate, etc.).
 *
 * The central error handler (middlewares/error-handler.ts) catches these and
 * turns them into a clean JSON response with the right HTTP status code.
 *
 * Using one error class keeps controllers simple: they just `throw` and let
 * the handler format the response. This is the DRY principle in practice.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  // Optional machine-readable detail list (e.g. Zod field errors).
  public readonly errors?: unknown[];
  // Marks errors we created on purpose vs. unexpected crashes.
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, errors?: unknown[]) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  // Factory helpers make call sites read nicely: ApiError.notFound('Shop').
  static badRequest(message = 'Bad request', errors?: unknown[]) {
    return new ApiError(400, message, errors);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message);
  }
  static notFound(resource = 'Resource') {
    return new ApiError(404, `${resource} not found`);
  }
  static conflict(message = 'Resource already exists') {
    return new ApiError(409, message);
  }
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message);
  }
  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }
}
