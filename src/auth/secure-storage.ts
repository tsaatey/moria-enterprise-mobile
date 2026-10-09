import * as SecureStore from 'expo-secure-store';

import type { User } from '@/api/types';

/**
 * Keychain / Keystore. AFTER_FIRST_UNLOCK so a background sync can still
 * read the refresh token while the phone is locked. THIS_DEVICE_ONLY keeps
 * tokens out of backups — a restored phone must sign in again.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const KEYS = {
  deviceId: 'moria.deviceId',
  refreshToken: 'moria.refreshToken',
  user: 'moria.user',
  pinHash: 'moria.pinHash',
  pinFailures: 'moria.pinFailures',
} as const;

type Key = keyof typeof KEYS;

async function get(key: Key): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS[key], OPTIONS);
}

async function set(key: Key, value: string | null): Promise<void> {
  if (value === null) await SecureStore.deleteItemAsync(KEYS[key], OPTIONS);
  else await SecureStore.setItemAsync(KEYS[key], value, OPTIONS);
}

export const secureStorage = {
  getDeviceId: () => get('deviceId'),
  setDeviceId: (id: string) => set('deviceId', id),

  getRefreshToken: () => get('refreshToken'),
  setRefreshToken: (token: string | null) => set('refreshToken', token),

  async getUser(): Promise<User | null> {
    const raw = await get('user');
    return raw ? (JSON.parse(raw) as User) : null;
  },
  setUser: (user: User | null) => set('user', user ? JSON.stringify(user) : null),

  getPinHash: () => get('pinHash'),
  setPinHash: (hash: string | null) => set('pinHash', hash),

  async getPinFailures(): Promise<number> {
    return Number((await get('pinFailures')) ?? 0);
  },
  setPinFailures: (n: number) => set('pinFailures', n ? String(n) : null),

  /** Wipe the session. The device id survives — it identifies the handset, not the user. */
  async clearSession(): Promise<void> {
    await Promise.all([set('refreshToken', null), set('user', null), set('pinHash', null), set('pinFailures', null)]);
  },
};
