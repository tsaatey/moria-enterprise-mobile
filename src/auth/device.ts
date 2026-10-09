import * as Device from 'expo-device';

import { newId } from '@/lib/ids';

import { secureStorage } from './secure-storage';

let cached: string | null = null;

/**
 * The install's device id, generated once and sent with login so the server
 * can bind refresh tokens and `lastSyncedAt` to this handset. Login claims
 * the device server-side, so no separate `POST /devices` is needed first.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await secureStorage.getDeviceId();
  if (!id) {
    id = newId();
    await secureStorage.setDeviceId(id);
  }
  cached = id;
  return id;
}

/** e.g. "Ama's Infinix" is what the owner sees in the devices list; we send the model name. */
export function getDeviceName(): string | null {
  return Device.deviceName ?? Device.modelName ?? null;
}
