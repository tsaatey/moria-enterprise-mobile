import type { SQLiteDatabase } from 'expo-sqlite';

import * as syncApi from '@/api/sync';
import type { Role } from '@/api/types';
import * as debtsApi from '@/api/debts';
import * as shopsApi from '@/api/shops';
import { saveDebts } from '@/db/debts';
import { getMeta, setMeta } from '@/db/meta';
import { saveShops } from '@/db/shops';
import { nowIso } from '@/lib/dates';

import { applyChanges } from './pull';
import { applyPushResult, collectPending, isEmpty, isFull } from './push';

export interface SyncContext {
  db: SQLiteDatabase;
  deviceId: string;
  userId: string;
  role: Role;
}

export interface SyncResult {
  pushed: number;
  rejected: number;
  pulledAt: string;
}

/** Guards against runaway loops if the server keeps answering a full batch. */
const MAX_PUSH_ROUNDS = 20;

let inFlight: Promise<SyncResult> | null = null;

/**
 * Push everything queued, then pull changes since the cursor. Push first so
 * the pull reflects this device's own sales in server-derived stock.
 * Concurrent callers share one run.
 */
export function runSync(ctx: SyncContext): Promise<SyncResult> {
  inFlight ??= doSync(ctx).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync({ db, deviceId, userId, role }: SyncContext): Promise<SyncResult> {
  let pushed = 0;
  let rejected = 0;

  for (let round = 0; round < MAX_PUSH_ROUNDS; round++) {
    const batch = await collectPending(db, { deviceId, userId, role });
    if (isEmpty(batch)) break;
    const result = await syncApi.push(batch);
    await applyPushResult(db, batch, result);
    const a = result.accepted;
    pushed += a.customers + a.sales + a.payments + a.stockMovements;
    rejected += result.rejected.length;
    if (!isFull(batch)) break;
  }

  // Small bounded set, outside the sync delta: the owner's POS shop picker.
  await saveShops(db, await shopsApi.listShops());

  const since = await getMeta(db, 'syncCursor');
  const delta = await syncApi.changes(since);
  await applyChanges(db, delta);
  // Cursor is the server's clock, never the device's.
  await setMeta(db, 'syncCursor', delta.serverTime);

  // Balances are derived server-side (the `debts` view), not carried by the
  // pull; refresh the cache after the push so it includes this device's work.
  await saveDebts(db, await debtsApi.listAllDebts());
  const pulledAt = nowIso();
  await setMeta(db, 'lastSyncedAt', pulledAt);

  return { pushed, rejected, pulledAt };
}

/**
 * Records waiting to go up for `userId` (excludes rejected ones awaiting
 * correction), and how many other users' records are queued on this phone.
 */
export async function countPending(db: SQLiteDatabase, userId: string): Promise<{ mine: number; others: number }> {
  const row = await db.getFirstAsync<{ mine: number; total: number }>(
    `SELECT
       (SELECT COUNT(*) FROM sales WHERE syncStatus = 'pending' AND userId = ?) +
       (SELECT COUNT(*) FROM payments WHERE syncStatus = 'pending' AND atCheckout = 0 AND receivedBy = ?) +
       (SELECT COUNT(*) FROM customers WHERE syncStatus = 'pending' AND createdBy = ?) +
       (SELECT COUNT(*) FROM stockMovements WHERE syncStatus = 'pending' AND userId = ?) AS mine,
       (SELECT COUNT(*) FROM sales WHERE syncStatus = 'pending') +
       (SELECT COUNT(*) FROM payments WHERE syncStatus = 'pending' AND atCheckout = 0) +
       (SELECT COUNT(*) FROM customers WHERE syncStatus = 'pending') +
       (SELECT COUNT(*) FROM stockMovements WHERE syncStatus = 'pending') AS total`,
    userId,
    userId,
    userId,
    userId,
  );
  const mine = row?.mine ?? 0;
  return { mine, others: (row?.total ?? 0) - mine };
}
