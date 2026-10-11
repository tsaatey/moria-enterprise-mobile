import type { SQLiteDatabase } from 'expo-sqlite';

/** How long a write waits for another connection's lock before failing. */
export const BUSY_TIMEOUT_MS = 5000;

/**
 * An exclusive write transaction that waits for the lock instead of failing.
 *
 * expo-sqlite runs each exclusive transaction on a fresh connection, and
 * SQLite's default busy timeout is zero: while one transaction writes, any
 * other write fails at once with "database is locked". At unlock a sync, the
 * working-shop save and the dashboard cache all write together, so the
 * timeout is set on every transaction's connection (and on the main one, in
 * migrateDbIfNeeded). Use this instead of withExclusiveTransactionAsync.
 */
export function writeTransaction(db: SQLiteDatabase, task: (txn: SQLiteDatabase) => Promise<void>): Promise<void> {
  return db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    await task(txn);
  });
}
