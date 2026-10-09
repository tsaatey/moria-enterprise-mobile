import type { SQLiteDatabase } from 'expo-sqlite';

import type { Debt, PaymentMethod } from '@/api/types';
import { calendarDate, nowIso } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { type Money, money, toMoney } from '@/lib/money';

import { getMeta, setMeta } from './meta';

export interface OpenDebt {
  saleId: string;
  shopId: string;
  shopName: string | null;
  customerId: string;
  totalAmount: Money;
  balance: Money;
  dueDate: string;
  overdue: boolean;
  saleRecordedAt: string;
  /** True when the figure includes sales or payments the server has not confirmed yet. */
  provisional: boolean;
}

/** Replace the cache with a fresh `GET /debts` (the server's `debts` view). */
export async function saveDebts(db: SQLiteDatabase, debts: Debt[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM debtsCache');
    for (const d of debts) {
      await txn.runAsync(
        `INSERT INTO debtsCache (saleId, shopId, shopName, customerId, totalAmount, amountPaid, amountReturned,
           balance, dueDate, lastPaymentAt, saleRecordedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.saleId,
        d.shopId,
        d.shop?.name ?? null,
        d.customerId,
        d.totalAmount,
        d.amountPaid,
        d.amountReturned,
        d.balance,
        d.dueDate,
        d.lastPaymentAt,
        d.saleRecordedAt,
      );
    }
  });
  await setMeta(db, 'debtsFetchedAt', nowIso());
}

interface CachedRow {
  saleId: string;
  shopId: string;
  shopName: string | null;
  customerId: string;
  totalAmount: string;
  balance: string;
  dueDate: string;
  saleRecordedAt: string;
}

interface LocalSaleRow {
  id: string;
  shopId: string;
  shopName: string | null;
  customerId: string;
  totalAmount: string;
  dueDate: string;
  deviceRecordedAt: string;
}

interface LocalPaymentRow {
  saleId: string;
  amount: string;
  late: number;
}

/**
 * Open credit sales as the device knows them: the server's cached `debts`
 * view, plus what the device has recorded since that the server has not
 * answered for yet (unsynced credit sales, unsynced instalments, and
 * anything recorded after the cache was fetched). Oldest due first, overdue
 * first — a work queue, as the API orders it.
 *
 * `overdue` uses the view's own rule (balance > 0 and dueDate before today
 * in the shop's timezone), recomputed so a cache fetched yesterday is still
 * right today.
 */
export async function getOpenDebts(db: SQLiteDatabase, { customerId }: { customerId?: string } = {}): Promise<OpenDebt[]> {
  const fetchedAt = (await getMeta(db, 'debtsFetchedAt')) ?? '';
  const byCustomer = customerId ? ' AND customerId = ?' : '';
  const cParams = customerId ? [customerId] : [];

  const cached = await db.getAllAsync<CachedRow>(`SELECT * FROM debtsCache WHERE 1 = 1${byCustomer}`, ...cParams);
  const cachedIds = new Set(cached.map((c) => c.saleId));

  const localSales = await db.getAllAsync<LocalSaleRow>(
    `SELECT s.id, s.shopId, sh.name AS shopName, s.customerId, s.totalAmount, s.dueDate, s.deviceRecordedAt
     FROM sales s LEFT JOIN shops sh ON sh.id = s.shopId
     WHERE s.saleType = 'credit' AND s.status = 'completed' AND s.customerId IS NOT NULL
       AND (s.syncStatus <> 'synced' OR s.deviceRecordedAt > ?)${customerId ? ' AND s.customerId = ?' : ''}`,
    fetchedAt,
    ...cParams,
  );

  // Payments the cached balance cannot include yet.
  const payments = await db.getAllAsync<LocalPaymentRow>(
    `SELECT saleId, amount, (syncStatus <> 'synced' OR deviceRecordedAt > ?) AS late FROM payments`,
    fetchedAt,
  );
  const paidAll = new Map<string, ReturnType<typeof money>>();
  const paidLate = new Map<string, ReturnType<typeof money>>();
  for (const p of payments) {
    paidAll.set(p.saleId, (paidAll.get(p.saleId) ?? money(0)).plus(p.amount));
    if (p.late) paidLate.set(p.saleId, (paidLate.get(p.saleId) ?? money(0)).plus(p.amount));
  }

  const today = calendarDate();
  const out: OpenDebt[] = [];

  for (const c of cached) {
    const late = paidLate.get(c.saleId);
    const balance = late ? money(c.balance).minus(late) : money(c.balance);
    if (balance.lte(0)) continue;
    out.push({
      saleId: c.saleId,
      shopId: c.shopId,
      shopName: c.shopName,
      customerId: c.customerId,
      totalAmount: c.totalAmount,
      balance: toMoney(balance),
      dueDate: c.dueDate,
      overdue: c.dueDate < today,
      saleRecordedAt: c.saleRecordedAt,
      provisional: !!late,
    });
  }

  for (const s of localSales) {
    if (cachedIds.has(s.id)) continue;
    const balance = money(s.totalAmount).minus(paidAll.get(s.id) ?? 0);
    if (balance.lte(0)) continue;
    out.push({
      saleId: s.id,
      shopId: s.shopId,
      shopName: s.shopName,
      customerId: s.customerId,
      totalAmount: s.totalAmount,
      balance: toMoney(balance),
      dueDate: s.dueDate,
      overdue: s.dueDate < today,
      saleRecordedAt: s.deviceRecordedAt,
      provisional: true,
    });
  }

  return out.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate));
}

/**
 * A debt instalment, recorded offline and pushed as a standalone payment.
 * The server refuses an over-payment, so callers keep `amount` within the
 * debt's balance; a race with another device comes back as a rejection.
 */
export async function recordDebtPayment(
  db: SQLiteDatabase,
  p: { saleId: string; shopId: string; amount: Money; method: PaymentMethod; momoReference: string | null; receivedBy: string },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO payments (id, saleId, shopId, amount, method, momoReference, receivedBy, atCheckout, deviceRecordedAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending')`,
    newId(),
    p.saleId,
    p.shopId,
    toMoney(p.amount),
    p.method,
    p.method === 'momo' ? p.momoReference?.trim() || null : null,
    p.receivedBy,
    nowIso(),
  );
}
