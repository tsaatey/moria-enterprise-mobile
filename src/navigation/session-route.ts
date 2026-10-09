import type { useSession } from '@/auth/session-store';

type SessionStatus = ReturnType<typeof useSession.getState>['status'];

/** Screens that belong to a session status other than `ready`. */
export const AUTH_PATHS = ['/login', '/pin', '/set-pin', '/change-password'] as const;

/**
 * The screen a session status belongs on — the one place that mapping lives.
 * Null while booting, when nothing should be shown yet.
 */
export function sessionRoute(status: SessionStatus, role: string | undefined) {
  switch (status) {
    case 'signedOut':
      return '/login';
    case 'locked':
      return '/pin';
    case 'setPin':
      return '/set-pin';
    case 'passwordChange':
      return '/change-password';
    case 'ready':
      return role === 'owner' ? '/dashboard' : '/pos';
    default:
      return null;
  }
}

/**
 * Whether `pathname` is a place the app may be for this status: any app
 * screen once signed in, otherwise exactly the status's own screen.
 */
export function isAllowedPath(pathname: string, status: SessionStatus, role: string | undefined) {
  if (status === 'booting') return true;
  if (status === 'ready') {
    return pathname !== '/' && !(AUTH_PATHS as readonly string[]).includes(pathname);
  }
  return pathname === sessionRoute(status, role);
}
