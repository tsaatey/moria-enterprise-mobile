/**
 * The backend's single error envelope:
 *   { "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {} } }
 *
 * Branch on `code`, never on HTTP status. NOT_FOUND and CONFLICT are 400 by
 * design; only a missing route is a 404.
 */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'NOT_FOUND'
  | 'PUBLIC_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'CUSTOMER_INCOMPLETE'
  | 'ROUTE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | string,
    message: string,
    readonly status: number,
    /** For VALIDATION_ERROR, a `{ field: message }` map with dotted paths. */
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The request never got an answer — offline, DNS, timeout. Not a server verdict. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Network request failed');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export function isApiError(e: unknown, code?: ApiErrorCode): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}
