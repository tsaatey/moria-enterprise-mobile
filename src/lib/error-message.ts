import { ApiError, NetworkError } from '@/api/errors';

/** User-facing text for a failed call. Branches on `code`, never HTTP status. */
export function errorMessage(e: unknown): string {
  if (e instanceof NetworkError) return 'No connection. Check your network and try again.';
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'UNAUTHORIZED':
        return 'Phone number or password is incorrect.';
      case 'RATE_LIMITED':
        return 'Too many attempts. Wait a minute and try again.';
      case 'VALIDATION_ERROR': {
        const first = Object.values(e.details)[0];
        return typeof first === 'string' ? first : e.message;
      }
      default:
        return e.message;
    }
  }
  return 'Something went wrong.';
}
