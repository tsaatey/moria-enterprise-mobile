import type { SQLiteDatabase } from 'expo-sqlite';

import { nowIso } from '@/lib/dates';
import { newId } from '@/lib/ids';

/**
 * An owner's restock, recorded offline: the movement is queued for
 * `POST /sync/push` (owner only, never `sale` type) and the shop's cached
 * quantity moves at once. The next pull replaces that figure with the
 * server's, which the movement will have produced.
 */
export async function recordRestock(
  db: SQLiteDatabase,
  r: { shopId: string; productId: string; quantity: number; reason: string | null; userId: string },
): Promise<void> {
  if (!Number.isInteger(r.quantity) || r.quantity < 1) throw new Error('A restock adds at least one unit');
  const at = nowIso();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO stockMovements (id, shopId, productId, movementType, quantityChange, reason, saleId, deviceRecordedAt, userId, syncStatus)
       VALUES (?, ?, ?, 'restock', ?, ?, NULL, ?, ?, 'pending')`,
      newId(),
      r.shopId,
      r.productId,
      r.quantity,
      r.reason?.trim() || null,
      at,
      r.userId,
    );
    await txn.runAsync(
      `INSERT INTO shopInventory (shopId, productId, quantity, reorderLevel, updatedAt)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT (shopId, productId) DO UPDATE SET quantity = shopInventory.quantity + excluded.quantity`,
      r.shopId,
      r.productId,
      r.quantity,
      at,
    );
  });
}
