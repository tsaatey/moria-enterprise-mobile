import Database from 'better-sqlite3';
import type { SQLiteDatabase } from 'expo-sqlite';

type Params = (string | number | null)[];

/**
 * The slice of expo-sqlite's async API this app uses, over an in-memory
 * better-sqlite3 database, so schema and queries run as real SQL in Jest.
 */
export function memoryDb(): SQLiteDatabase {
  const raw = new Database(':memory:');
  const norm = (params: unknown[]): Params =>
    params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : (p as string | number | null)));

  const db: Record<string, (...args: never[]) => Promise<unknown>> = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const r = raw.prepare(sql).run(...norm(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    async getFirstAsync(sql: string, ...params: unknown[]) {
      const stmt = raw.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('PRAGMA')) {
        const [name] = sql.trim().split(/\s+/).slice(1);
        return { [name]: raw.pragma(name, { simple: true }) };
      }
      return stmt.get(...norm(params)) ?? null;
    },
    async getAllAsync(sql: string, ...params: unknown[]) {
      return raw.prepare(sql).all(...norm(params));
    },
    async withExclusiveTransactionAsync(cb: (txn: unknown) => Promise<void>): Promise<void> {
      raw.exec('BEGIN');
      try {
        await cb(db);
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  db.withTransactionAsync = (cb: () => Promise<void>) => (db.withExclusiveTransactionAsync as (c: unknown) => Promise<void>)(cb);
  return db as unknown as SQLiteDatabase;
}
