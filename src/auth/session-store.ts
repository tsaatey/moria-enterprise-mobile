import { create } from 'zustand';

import * as authApi from '@/api/auth';
import { setAuthHooks } from '@/api/client';
import { isApiError, NetworkError } from '@/api/errors';
import type { TokenPair, User } from '@/api/types';

import { getDeviceId, getDeviceName } from './device';
import { hashPin, MAX_PIN_FAILURES, verifyPin } from './pin';
import { secureStorage } from './secure-storage';

/**
 * booting        — reading secure storage
 * signedOut      — needs phone + password
 * locked         — a session exists on this device; needs the PIN (works offline)
 * passwordChange — the API holds the account until its password changes
 * setPin         — signed in, no PIN on this device yet
 * ready          — in the app
 */
export type SessionStatus = 'booting' | 'signedOut' | 'locked' | 'passwordChange' | 'setPin' | 'ready';

interface SessionState {
  status: SessionStatus;
  user: User | null;
  deviceId: string | null;
  /** 15-minute JWT. Memory only — never persisted. */
  accessToken: string | null;

  bootstrap(): Promise<void>;
  login(phone: string, password: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  setPin(pin: string): Promise<void>;
  /** Resolves to the attempts left, or throws when the session has been wiped. */
  unlock(pin: string): Promise<{ ok: boolean; attemptsLeft: number }>;
  lock(): void;
  logout(): Promise<void>;
}

async function persistPair(pair: TokenPair): Promise<void> {
  // Store the rotated refresh token before anything else can fail: the old
  // one is already dead server-side.
  await secureStorage.setRefreshToken(pair.refreshToken);
  await secureStorage.setUser(pair.user);
}

export const useSession = create<SessionState>()((set, get) => ({
  status: 'booting',
  user: null,
  deviceId: null,
  accessToken: null,

  async bootstrap() {
    // Launch only. RootLayout can remount (fast refresh, navigator changes);
    // re-reading storage then would see a session mid-setup — refresh token,
    // no PIN yet — and wipe it as abandoned.
    if (get().status !== 'booting') {
      if (!get().deviceId) set({ deviceId: await getDeviceId() });
      return;
    }
    const [deviceId, refreshToken, user, pinHash] = await Promise.all([
      getDeviceId(),
      secureStorage.getRefreshToken(),
      secureStorage.getUser(),
      secureStorage.getPinHash(),
    ]);
    if (refreshToken && user && pinHash) {
      set({ deviceId, user, status: 'locked' });
    } else {
      // A session without a PIN was abandoned mid-setup. Don't let whoever
      // holds the phone now choose the PIN for it.
      if (refreshToken || user) await secureStorage.clearSession();
      set({ deviceId, user: null, status: 'signedOut' });
    }
  },

  async login(phone, password) {
    const deviceId = get().deviceId ?? (await getDeviceId());
    const pair = await authApi.login({ phone, password, deviceId, deviceName: getDeviceName() });
    await persistPair(pair);
    await secureStorage.setPinHash(null);
    set({
      user: pair.user,
      accessToken: pair.accessToken,
      status: pair.user.mustChangePassword ? 'passwordChange' : 'setPin',
    });
  },

  async changePassword(currentPassword, newPassword) {
    const deviceId = get().deviceId ?? (await getDeviceId());
    const pair = await authApi.changePassword({ currentPassword, newPassword, deviceId, deviceName: getDeviceName() });
    await persistPair(pair);
    const hasPin = !!(await secureStorage.getPinHash());
    set({ user: pair.user, accessToken: pair.accessToken, status: hasPin ? 'ready' : 'setPin' });
  },

  async setPin(pin) {
    await secureStorage.setPinHash(await hashPin(pin));
    await secureStorage.setPinFailures(0);
    set({ status: 'ready' });
    // Best effort: the server copy only matters after a reinstall.
    authApi.setServerPin(pin).catch(() => {});
  },

  async unlock(pin) {
    const stored = await secureStorage.getPinHash();
    if (stored && (await verifyPin(pin, stored))) {
      await secureStorage.setPinFailures(0);
      set({ status: get().user?.mustChangePassword ? 'passwordChange' : 'ready' });
      return { ok: true, attemptsLeft: MAX_PIN_FAILURES };
    }
    const failures = (await secureStorage.getPinFailures()) + 1;
    if (failures >= MAX_PIN_FAILURES) {
      // § PIN Unlock: 5 failures wipe the local session.
      await secureStorage.clearSession();
      set({ user: null, accessToken: null, status: 'signedOut' });
      return { ok: false, attemptsLeft: 0 };
    }
    await secureStorage.setPinFailures(failures);
    return { ok: false, attemptsLeft: MAX_PIN_FAILURES - failures };
  },

  lock() {
    if (get().status === 'ready') set({ accessToken: null, status: 'locked' });
  },

  async logout() {
    const { deviceId } = get();
    if (deviceId) await authApi.logout(deviceId).catch(() => {});
    await secureStorage.clearSession();
    set({ user: null, accessToken: null, status: 'signedOut' });
  },
}));

let refreshing: Promise<string | null> | null = null;

/**
 * Single-flight: the API revokes every token on the device when a refresh
 * token is replayed, so two concurrent refreshes would log the user out.
 * A network failure rethrows (stay signed in, offline); only the server
 * refusing the token ends the session.
 */
function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    const token = await secureStorage.getRefreshToken();
    if (!token) return null;
    try {
      const pair = await authApi.refresh(token);
      await persistPair(pair);
      useSession.setState((s) => ({
        user: pair.user,
        accessToken: pair.accessToken,
        status: pair.user.mustChangePassword && s.status === 'ready' ? 'passwordChange' : s.status,
      }));
      return pair.accessToken;
    } catch (e) {
      if (e instanceof NetworkError) throw e;
      if (isApiError(e, 'UNAUTHORIZED') || isApiError(e, 'TOKEN_EXPIRED')) {
        await secureStorage.clearSession();
        useSession.setState({ user: null, accessToken: null, status: 'signedOut' });
        return null;
      }
      throw e;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

setAuthHooks({
  getAccessToken: () => useSession.getState().accessToken,
  refresh: refreshSession,
  onPasswordChangeRequired: () => useSession.setState({ status: 'passwordChange' }),
});
