import type { SQLiteDatabase } from 'expo-sqlite';

/** A record the server refused. It stays on the device until corrected and requeued. */
export interface SyncIssue {
  type: 'sale' | 'payment' | 'customer';
  id: string;
  code: string;
  message: string | null;
  /** For a sale or payment: the customer it concerns, if any. */
  customerId: string | null;
  customerLabel: string | null;
  amount: string | null;
  recordedAt: string | null;
}

/** The signed-in user's rejected records, newest first. */
export async function listSyncIssues(db: SQLiteDatabase, userId: string): Promise<SyncIssue[]> {
  return db.getAllAsync<SyncIssue>(
    `SELECT 'sale' AS type, s.id, s.syncErrorCode AS code, s.syncErrorMessage AS message, s.customerId,
            COALESCE(c.name, c.phone) AS customerLabel, s.totalAmount AS amount, s.deviceRecordedAt AS recordedAt
       FROM sales s LEFT JOIN customers c ON c.id = s.customerId
       WHERE s.syncStatus = 'rejected' AND s.userId = ?
     UNION ALL
     SELECT 'payment', p.id, p.syncErrorCode, p.syncErrorMessage, s.customerId,
            COALESCE(c.name, c.phone), p.amount, p.deviceRecordedAt
       FROM payments p LEFT JOIN sales s ON s.id = p.saleId LEFT JOIN customers c ON c.id = s.customerId
       WHERE p.syncStatus = 'rejected' AND p.atCheckout = 0 AND p.receivedBy = ?
     UNION ALL
     SELECT 'customer', c.id, c.syncErrorCode, c.syncErrorMessage, c.id, COALESCE(c.name, c.phone), NULL, c.updatedAt
       FROM customers c
       WHERE c.syncStatus = 'rejected' AND c.createdBy = ?
     ORDER BY recordedAt DESC`,
    userId,
    userId,
    userId,
  );
}

const TABLE = { sale: 'sales', payment: 'payments', customer: 'customers' } as const;

/**
 * Put a corrected record back in the queue. A sale takes its checkout
 * payments with it; a sale whose customer was the problem requeues the
 * customer too, so the completed profile travels in the same push.
 */
export async function requeue(db: SQLiteDatabase, issue: Pick<SyncIssue, 'type' | 'id' | 'customerId'>): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE ${TABLE[issue.type]} SET syncStatus = 'pending', syncErrorCode = NULL, syncErrorMessage = NULL WHERE id = ?`,
      issue.id,
    );
    if (issue.type === 'sale') {
      await txn.runAsync(`UPDATE payments SET syncStatus = 'pending' WHERE saleId = ? AND atCheckout = 1`, issue.id);
      if (issue.customerId) {
        await txn.runAsync(
          `UPDATE customers SET syncStatus = 'pending', syncErrorCode = NULL, syncErrorMessage = NULL
           WHERE id = ? AND syncStatus <> 'pending'`,
          issue.customerId,
        );
      }
    }
  });
}
