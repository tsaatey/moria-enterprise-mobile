import * as shopsApi from '@/api/shops';
import * as syncApi from '@/api/sync';
import { getMeta } from '@/db/meta';
import { recordSale } from '@/db/sales';
import { migrateDbIfNeeded } from '@/db/schema';
import { countPending, runSync } from '@/sync/engine';

import { memoryDb } from './helpers/memory-db';

jest.mock('@/api/sync', () => ({ ...jest.requireActual('@/api/sync'), push: jest.fn(), changes: jest.fn() }));
jest.mock('@/api/shops', () => ({ listShops: jest.fn() }));

const push = syncApi.push as jest.Mock;
const changes = syncApi.changes as jest.Mock;
const SHOP = '11111111-1111-4111-8111-111111111111';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const empty = { categories: [], products: [], shopInventory: [], customers: [] };

beforeEach(() => {
  jest.resetAllMocks();
  (shopsApi.listShops as jest.Mock).mockResolvedValue([{ id: SHOP, name: 'East Legon', location: null, momoNumber: null, isActive: true }]);
});

it('pushes before pulling, stores the server cursor, and sends it next time', async () => {
  const db = memoryDb();
  await migrateDbIfNeeded(db);
  await recordSale(db, {
    shopId: SHOP,
    userId: USER,
    saleType: 'fullPayment',
    customerId: null,
    dueDate: null,
    lines: [{ productId: 'p', quantity: 1, unitPrice: '10.00', subtotal: '10.00', priceTier: 'retail', retailPrice: '10.00' }],
    payment: { amount: '10.00', method: 'cash', momoReference: null },
  });
  expect((await countPending(db, USER)).mine).toBe(1);

  const order: string[] = [];
  push.mockImplementation(async () => {
    order.push('push');
    return { accepted: { customers: 0, sales: 1, payments: 0, stockMovements: 0 }, customerRemaps: [], rejected: [], serverTime: 'x' };
  });
  changes.mockImplementation(async (since: string | null) => {
    order.push(`pull:${since}`);
    return { changes: empty, serverTime: '2026-10-09T12:00:00.000Z' };
  });

  const ctx = { db, deviceId: 'dev', userId: USER, role: 'salesperson' as const };
  await runSync(ctx);
  expect(order).toEqual(['push', 'pull:null']);
  expect(await getMeta(db, 'syncCursor')).toBe('2026-10-09T12:00:00.000Z');
  expect(await countPending(db, USER)).toEqual({ mine: 0, others: 0 });

  await runSync(ctx);
  // Nothing left to push; the pull resumes from the stored cursor.
  expect(order).toEqual(['push', 'pull:null', 'pull:2026-10-09T12:00:00.000Z']);
});
