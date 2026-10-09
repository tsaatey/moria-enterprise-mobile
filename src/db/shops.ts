import type { SQLiteDatabase } from 'expo-sqlite';

import type { Shop } from '@/api/types';

export async function saveShops(db: SQLiteDatabase, shops: Shop[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const s of shops) {
      await txn.runAsync(
        `INSERT INTO shops (id, name, location, momoNumber, isActive) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, location = excluded.location,
           momoNumber = excluded.momoNumber, isActive = excluded.isActive`,
        s.id,
        s.name,
        s.location,
        s.momoNumber,
        s.isActive ? 1 : 0,
      );
    }
  });
}

export function listActiveShops(db: SQLiteDatabase): Promise<Shop[]> {
  return db
    .getAllAsync<Omit<Shop, 'isActive'> & { isActive: number }>('SELECT * FROM shops WHERE isActive = 1 ORDER BY name')
    .then((rows) => rows.map((r) => ({ ...r, isActive: !!r.isActive })));
}
