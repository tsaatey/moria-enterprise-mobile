import type { SQLiteDatabase } from 'expo-sqlite';

import * as syncApi from '@/api/sync';
import type { PushRequest, PushResponse, PushSale } from '@/api/sync';
import type { Role } from '@/api/types';

type SyncRow = { syncStatus: string };

interface CustomerRow extends SyncRow {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  smsOptIn: number;
}

interface SaleRow extends SyncRow {
  id: string;
  shopId: string;
  customerId: string | null;
  saleType: PushSale['saleType'];
  totalAmount: string;
  dueDate: string | null;
  note: string | null;
  deviceRecordedAt: string;
}

interface SaleItemRow {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  priceTier: 'retail' | 'wholesale';
}

interface PaymentRow {
  id: string;
  saleId: string;
  amount: string;
  method: 'cash' | 'momo';
  momoReference: string | null;
  deviceRecordedAt: string;
}

interface MovementRow {
  id: string;
  shopId: string;
  productId: string;
  movementType: 'restock' | 'return' | 'adjustment';
  quantityChange: number;
  reason: string | null;
  saleId: string | null;
  deviceRecordedAt: string;
}

const LIMIT = syncApi.PUSH_BATCH_LIMIT;

/**
 * Build one push batch from the signed-in user's `pending` rows. The server
 * attributes every record to the token's user, so another user's queue on
 * this phone waits until they sign in again. Rejected rows wait for correction.
 *
 * Customers are the one exception: a pending customer another user created
 * is still pushed when one of this user's sales points at it, or that sale
 * would be refused for a customer the server has never seen.
 */
export async function collectPending(
  db: SQLiteDatabase,
  { deviceId, userId, role }: { deviceId: string; userId: string; role: Role },
): Promise<PushRequest> {
  const customers = await db.getAllAsync<CustomerRow>(
    `SELECT id, phone, name, address, smsOptIn, syncStatus FROM customers
     WHERE syncStatus = 'pending'
       AND (createdBy = ? OR id IN (SELECT customerId FROM sales WHERE syncStatus = 'pending' AND userId = ?))
     LIMIT ?`,
    userId,
    userId,
    LIMIT,
  );

  const saleRows = await db.getAllAsync<SaleRow>(
    `SELECT * FROM sales WHERE syncStatus = 'pending' AND userId = ? ORDER BY deviceRecordedAt LIMIT ?`,
    userId,
    LIMIT,
  );
  const saleIds = saleRows.map((s) => s.id);
  const placeholders = saleIds.map(() => '?').join(',');
  const items = saleIds.length
    ? await db.getAllAsync<SaleItemRow>(`SELECT * FROM saleItems WHERE saleId IN (${placeholders})`, ...saleIds)
    : [];
  const checkoutPayments = saleIds.length
    ? await db.getAllAsync<PaymentRow>(
        `SELECT * FROM payments WHERE atCheckout = 1 AND saleId IN (${placeholders})`,
        ...saleIds,
      )
    : [];

  const sales: PushSale[] = saleRows.map((s) => ({
    id: s.id,
    shopId: s.shopId,
    customerId: s.customerId,
    saleType: s.saleType,
    totalAmount: s.totalAmount,
    dueDate: s.dueDate,
    note: s.note,
    deviceRecordedAt: s.deviceRecordedAt,
    items: items
      .filter((i) => i.saleId === s.id)
      .map(({ id, productId, quantity, unitPrice, subtotal, priceTier }) => ({
        id,
        productId,
        quantity,
        unitPrice,
        subtotal,
        priceTier,
      })),
    payments: checkoutPayments
      .filter((p) => p.saleId === s.id)
      .map(({ id, amount, method, momoReference, deviceRecordedAt }) => ({
        id,
        amount,
        method,
        momoReference,
        deviceRecordedAt,
      })),
  }));

  const payments = await db.getAllAsync<PaymentRow>(
    `SELECT id, saleId, amount, method, momoReference, deviceRecordedAt FROM payments
     WHERE syncStatus = 'pending' AND atCheckout = 0 AND receivedBy = ? ORDER BY deviceRecordedAt LIMIT ?`,
    userId,
    LIMIT,
  );

  // Owner only: the API refuses stock movements from a salesperson.
  const stockMovements =
    role === 'owner'
      ? await db.getAllAsync<MovementRow>(
          `SELECT id, shopId, productId, movementType, quantityChange, reason, saleId, deviceRecordedAt
           FROM stockMovements WHERE syncStatus = 'pending' AND userId = ? ORDER BY deviceRecordedAt LIMIT ?`,
          userId,
          LIMIT,
        )
      : [];

  return {
    deviceId,
    customers: customers.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      address: c.address,
      smsOptIn: !!c.smsOptIn,
    })),
    sales,
    payments,
    stockMovements,
  };
}

export function isEmpty(batch: PushRequest): boolean {
  return !batch.customers.length && !batch.sales.length && !batch.payments.length && !batch.stockMovements.length;
}

/** Whether any collection filled its cap, so another round may have more. */
export function isFull(batch: PushRequest): boolean {
  return [batch.customers, batch.sales, batch.payments, batch.stockMovements].some((c) => c.length >= LIMIT);
}

/**
 * Record what the server did with a batch. Everything pushed and not named in
 * `rejected` was accepted (re-pushing an accepted id is a no-op server side).
 */
export async function applyPushResult(db: SQLiteDatabase, batch: PushRequest, result: PushResponse): Promise<void> {
  const rejected = new Map(result.rejected.filter((r) => r.id).map((r) => [`${r.type}:${r.id}`, r]));

  const mark = async (txn: SQLiteDatabase, table: string, type: string, id: string) => {
    const r = rejected.get(`${type}:${id}`);
    if (r) {
      await txn.runAsync(
        `UPDATE ${table} SET syncStatus = 'rejected', syncErrorCode = ?, syncErrorMessage = ? WHERE id = ?`,
        r.code,
        r.message,
        id,
      );
    } else {
      await txn.runAsync(
        `UPDATE ${table} SET syncStatus = 'synced', syncErrorCode = NULL, syncErrorMessage = NULL WHERE id = ?`,
        id,
      );
    }
    return !r;
  };

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const c of batch.customers) await mark(txn, 'customers', 'customer', c.id);

    for (const s of batch.sales) {
      const ok = await mark(txn, 'sales', 'sale', s.id);
      // Checkout payments travel inside their sale and share its fate.
      await txn.runAsync(
        `UPDATE payments SET syncStatus = ? WHERE saleId = ? AND atCheckout = 1`,
        ok ? 'synced' : 'rejected',
        s.id,
      );
    }

    for (const p of batch.payments) await mark(txn, 'payments', 'payment', p.id);
    for (const m of batch.stockMovements) await mark(txn, 'stockMovements', 'stockMovement', m.id);

    // A pushed phone that already existed was merged onto the server's
    // customer: rewrite local references to the server id.
    for (const { localId, serverId } of result.customerRemaps) {
      await txn.runAsync('UPDATE sales SET customerId = ? WHERE customerId = ?', serverId, localId);
      const existing = await txn.getFirstAsync<{ id: string }>('SELECT id FROM customers WHERE id = ?', serverId);
      if (existing) {
        await txn.runAsync('DELETE FROM customers WHERE id = ?', localId);
      } else {
        await txn.runAsync(`UPDATE customers SET id = ?, syncStatus = 'synced' WHERE id = ?`, serverId, localId);
      }
    }
  });
}
