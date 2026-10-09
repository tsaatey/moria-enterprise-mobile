import * as Crypto from 'expo-crypto';

/**
 * Every record the device can create offline (sales, sale items, payments,
 * customers, stock movements) gets its UUID here, at creation time. The
 * server inserts with ON CONFLICT DO NOTHING, so re-pushing is always safe.
 */
export function newId(): string {
  return Crypto.randomUUID();
}
