import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/dates';
import { normalizePhoneIfPossible } from '@/lib/phone';

export interface LocalCustomer {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  smsOptIn: number;
  syncStatus: string;
}

/** Mirrors `Customer.isCreditEligible`: name and address present and not just whitespace. */
export function isCreditEligible(c: Pick<LocalCustomer, 'name' | 'address'>): boolean {
  return !!c.name?.trim() && !!c.address?.trim();
}

export async function searchCustomers(
  db: SQLiteDatabase,
  { search, creditOnly, limit = 30 }: { search?: string; creditOnly?: boolean; limit?: number },
): Promise<LocalCustomer[]> {
  const where = ['deletedAt IS NULL'];
  const params: (string | number)[] = [];
  if (creditOnly) where.push(`TRIM(COALESCE(name, '')) <> '' AND TRIM(COALESCE(address, '')) <> ''`);
  const q = search?.trim();
  if (q) {
    where.push(`(name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')`);
    const esc = (v: string) => `%${v.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    // "+233 24 400 0000" finds "0244000000", as the API's search does.
    params.push(esc(q), esc(normalizePhoneIfPossible(q)));
  }
  params.push(limit);
  return db.getAllAsync<LocalCustomer>(
    `SELECT id, phone, name, address, smsOptIn, syncStatus FROM customers
     WHERE ${where.join(' AND ')} ORDER BY name IS NULL, name COLLATE NOCASE, phone LIMIT ?`,
    ...params,
  );
}

export function findCustomerByPhone(db: SQLiteDatabase, phone: string): Promise<LocalCustomer | null> {
  return db.getFirstAsync<LocalCustomer>(
    'SELECT id, phone, name, address, smsOptIn, syncStatus FROM customers WHERE phone = ? AND deletedAt IS NULL',
    phone,
  );
}

/** Created offline with a device id; sync merges it by phone if the server already knows the number. */
export async function createCustomer(
  db: SQLiteDatabase,
  input: { phone: string; name: string | null; address: string | null; smsOptIn: boolean; createdBy: string },
): Promise<LocalCustomer> {
  const customer: LocalCustomer = {
    id: newId(),
    phone: input.phone,
    name: input.name?.trim() || null,
    address: input.address?.trim() || null,
    smsOptIn: input.smsOptIn ? 1 : 0,
    syncStatus: 'pending',
  };
  await db.runAsync(
    `INSERT INTO customers (id, phone, name, address, smsOptIn, createdBy, updatedAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    customer.id,
    customer.phone,
    customer.name,
    customer.address,
    customer.smsOptIn,
    input.createdBy,
    nowIso(),
  );
  return customer;
}

/**
 * Fill a customer's missing name/address locally and queue them. Only empty
 * fields are filled, the same rule the server's merge-by-phone applies, so a
 * push of this row completes the profile without overwriting anything.
 */
export async function completeCustomer(
  db: SQLiteDatabase,
  id: string,
  { name, address }: { name: string | null; address: string | null },
): Promise<LocalCustomer | null> {
  await db.runAsync(
    `UPDATE customers SET
       name = CASE WHEN TRIM(COALESCE(name, '')) = '' THEN ? ELSE name END,
       address = CASE WHEN TRIM(COALESCE(address, '')) = '' THEN ? ELSE address END,
       syncStatus = CASE WHEN syncStatus = 'synced' THEN 'pending' ELSE syncStatus END,
       updatedAt = ?
     WHERE id = ?`,
    name?.trim() || null,
    address?.trim() || null,
    nowIso(),
    id,
  );
  return db.getFirstAsync<LocalCustomer>('SELECT id, phone, name, address, smsOptIn, syncStatus FROM customers WHERE id = ?', id);
}
