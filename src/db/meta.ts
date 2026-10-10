import type { SQLiteDatabase } from 'expo-sqlite';

export type MetaKey = 'syncCursor' | 'lastSyncedAt' | 'debtsFetchedAt' | 'dashboardCache' | 'activeShopId';

export async function getMeta(db: SQLiteDatabase, key: MetaKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(db: SQLiteDatabase, key: MetaKey, value: string | null): Promise<void> {
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
