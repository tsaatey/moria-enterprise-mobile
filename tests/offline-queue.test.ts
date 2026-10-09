import type { PushResponse } from '@/api/sync';
import type { SQLiteDatabase } from 'expo-sqlite';
import { listPosProducts } from '@/db/catalog';
import { createCustomer } from '@/db/customers';
import { recordSale } from '@/db/sales';
import { migrateDbIfNeeded } from '@/db/schema';
import { applyChanges } from '@/sync/pull';
import { applyPushResult, collectPending } from '@/sync/push';

import { memoryDb } from './helpers/memory-db';

const SHOP = '11111111-1111-4111-8111-111111111111';
const AMA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const YAW = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CAT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WIG = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const T = '2026-10-09T10:00:00.000Z';

const changes = (over: Partial<Parameters<typeof applyChanges>[1]['changes']> = {}) => ({
  serverTime: T,
  changes: { categories: [], products: [], shopInventory: [], customers: [], ...over },
});

async function seededDb(): Promise<SQLiteDatabase> {
  const db = memoryDb();
  await migrateDbIfNeeded(db);
  await applyChanges(
    db,
    changes({
      categories: [{ id: CAT, name: 'Wigs', isActive: true, createdAt: T, updatedAt: T, deletedAt: null }],
      products: [
        {
          id: WIG,
          categoryId: CAT,
          name: 'Glueless Wig Unit',
          description: null,
          barcode: 'MOR-GWU-16',
          defaultPrice: '980.00',
          wholesalePrice: '800.00',
          wholesaleMinQuantity: 3,
          coverImageUrl: null,
          coverImageKey: null,
          isActive: true,
          createdAt: T,
          updatedAt: T,
          deletedAt: null,
        },
      ],
      shopInventory: [
        {
          shopId: SHOP,
          productId: WIG,
          quantity: 2,
          reorderLevel: 1,
          priceOverride: '950.00',
          effectivePrice: '950.00',
          wholesalePriceOverride: null,
          effectiveWholesalePrice: '800.00',
          wholesaleMinQuantity: 3,
          lowStock: false,
          oversold: false,
          updatedAt: T,
        },
      ],
    }),
  );
  return db;
}

describe('schema', () => {
  it('migrates a fresh database and is a no-op the second time', async () => {
    const db = memoryDb();
    await migrateDbIfNeeded(db);
    await migrateDbIfNeeded(db);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(2);
  });
});

describe('catalog read', () => {
  it("prices from the shop's inventory row and searches by barcode", async () => {
    const db = await seededDb();
    const [p] = await listPosProducts(db, SHOP, { search: 'gwu' });
    expect(p).toMatchObject({ id: WIG, retailPrice: '950.00', wholesalePrice: '800.00', wholesaleMinQuantity: 3, quantity: 2 });
  });

  it('falls back to catalog prices in a shop with no stock row', async () => {
    const db = await seededDb();
    const [p] = await listPosProducts(db, '99999999-9999-4999-8999-999999999999');
    expect(p).toMatchObject({ retailPrice: '980.00', wholesalePrice: '800.00', quantity: null });
  });

  it('hides a deactivated product', async () => {
    const db = await seededDb();
    await db.runAsync('UPDATE products SET isActive = 0');
    expect(await listPosProducts(db, SHOP)).toHaveLength(0);
  });
});

describe('recording a sale and pushing it', () => {
  it('queues a credit sale with its deposit in the POST /sales shape, and decrements stock', async () => {
    const db = await seededDb();
    const customer = await createCustomer(db, {
      phone: '0244000000',
      name: 'Ama Mensah',
      address: 'Lapaz, Accra',
      smsOptIn: true,
      createdBy: AMA,
    });
    const { id } = await recordSale(db, {
      shopId: SHOP,
      userId: AMA,
      saleType: 'credit',
      customerId: customer.id,
      dueDate: '2026-11-08',
      lines: [{ productId: WIG, quantity: 3, unitPrice: '800.00', subtotal: '2400.00', priceTier: 'wholesale', retailPrice: '950.00' }],
      payment: { amount: '500.00', method: 'cash', momoReference: 'ignored-for-cash' },
    });

    const batch = await collectPending(db, { deviceId: 'dev', userId: AMA, role: 'salesperson' });
    expect(batch.customers).toEqual([
      { id: customer.id, phone: '0244000000', name: 'Ama Mensah', address: 'Lapaz, Accra', smsOptIn: true },
    ]);
    expect(batch.sales).toHaveLength(1);
    expect(batch.sales[0]).toMatchObject({
      id,
      shopId: SHOP,
      customerId: customer.id,
      saleType: 'credit',
      totalAmount: '2400.00',
      dueDate: '2026-11-08',
      items: [{ productId: WIG, quantity: 3, unitPrice: '800.00', subtotal: '2400.00', priceTier: 'wholesale' }],
      payments: [{ amount: '500.00', method: 'cash', momoReference: null }],
    });
    expect(batch.payments).toEqual([]);
    expect(batch.stockMovements).toEqual([]);

    const inv = await db.getFirstAsync<{ quantity: number }>('SELECT quantity FROM shopInventory WHERE productId = ?', WIG);
    expect(inv?.quantity).toBe(-1);
  });

  it("never pushes another user's queue, but brings along a customer this user's sale needs", async () => {
    const db = await seededDb();
    const amasCustomer = await createCustomer(db, { phone: '0201112222', name: 'Efua', address: 'Tema', smsOptIn: true, createdBy: AMA });
    await createCustomer(db, { phone: '0203334444', name: null, address: null, smsOptIn: true, createdBy: AMA });
    const line = { productId: WIG, quantity: 1, unitPrice: '950.00', subtotal: '950.00', priceTier: 'retail' as const, retailPrice: '950.00' };
    await recordSale(db, { shopId: SHOP, userId: AMA, saleType: 'fullPayment', customerId: null, dueDate: null, lines: [line], payment: { amount: '950.00', method: 'momo', momoReference: 'MP1' } });
    await recordSale(db, { shopId: SHOP, userId: YAW, saleType: 'fullPayment', customerId: amasCustomer.id, dueDate: null, lines: [line], payment: { amount: '950.00', method: 'cash', momoReference: null } });

    const yaws = await collectPending(db, { deviceId: 'dev', userId: YAW, role: 'salesperson' });
    expect(yaws.sales).toHaveLength(1);
    expect(yaws.sales[0].payments[0].method).toBe('cash');
    expect(yaws.customers.map((c) => c.id)).toEqual([amasCustomer.id]);

    const amas = await collectPending(db, { deviceId: 'dev', userId: AMA, role: 'salesperson' });
    expect(amas.sales).toHaveLength(1);
    expect(amas.sales[0].payments[0]).toMatchObject({ method: 'momo', momoReference: 'MP1' });
    expect(amas.customers).toHaveLength(2);
  });

  it('marks accepted rows synced, keeps rejected ones with their code, and applies customer remaps', async () => {
    const db = await seededDb();
    const local = await createCustomer(db, { phone: '0244000000', name: 'Ama', address: 'Lapaz', smsOptIn: true, createdBy: AMA });
    const line = { productId: WIG, quantity: 1, unitPrice: '950.00', subtotal: '950.00', priceTier: 'retail' as const, retailPrice: '950.00' };
    const good = await recordSale(db, { shopId: SHOP, userId: AMA, saleType: 'credit', customerId: local.id, dueDate: '2026-11-08', lines: [line], payment: null });
    const bad = await recordSale(db, { shopId: SHOP, userId: AMA, saleType: 'fullPayment', customerId: null, dueDate: null, lines: [line], payment: { amount: '950.00', method: 'cash', momoReference: null } });

    const batch = await collectPending(db, { deviceId: 'dev', userId: AMA, role: 'salesperson' });
    const serverId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const result: PushResponse = {
      accepted: { customers: 1, sales: 1, payments: 0, stockMovements: 0 },
      customerRemaps: [{ localId: local.id, serverId }],
      rejected: [{ type: 'sale', id: bad.id, code: 'VALIDATION_ERROR', message: 'nope' }],
      serverTime: T,
    };
    await applyPushResult(db, batch, result);

    const sales = await db.getAllAsync<{ id: string; syncStatus: string; syncErrorCode: string | null; customerId: string | null }>(
      'SELECT id, syncStatus, syncErrorCode, customerId FROM sales',
    );
    expect(sales.find((s) => s.id === good.id)).toMatchObject({ syncStatus: 'synced', customerId: serverId });
    expect(sales.find((s) => s.id === bad.id)).toMatchObject({ syncStatus: 'rejected', syncErrorCode: 'VALIDATION_ERROR' });
    const pay = await db.getFirstAsync<{ syncStatus: string }>('SELECT syncStatus FROM payments WHERE saleId = ?', bad.id);
    expect(pay?.syncStatus).toBe('rejected');
    const customers = await db.getAllAsync<{ id: string }>('SELECT id FROM customers');
    expect(customers.map((c) => c.id)).toEqual([serverId]);

    const next = await collectPending(db, { deviceId: 'dev', userId: AMA, role: 'salesperson' });
    expect(next.sales).toHaveLength(0);
  });
});

describe('pull', () => {
  it('does not overwrite a customer the device has not pushed yet', async () => {
    const db = await seededDb();
    const local = await createCustomer(db, { phone: '0244000000', name: 'Local Name', address: null, smsOptIn: true, createdBy: AMA });
    await applyChanges(
      db,
      changes({
        customers: [
          { id: local.id, phone: '0244000000', name: 'Server Name', address: null, smsOptIn: true, optedOutAt: null, createdBy: AMA, createdAt: T, updatedAt: T, deletedAt: null },
        ],
      }),
    );
    const row = await db.getFirstAsync<{ name: string }>('SELECT name FROM customers WHERE id = ?', local.id);
    expect(row?.name).toBe('Local Name');
  });

  it("replaces optimistic stock with the server's figure", async () => {
    const db = await seededDb();
    await db.runAsync('UPDATE shopInventory SET quantity = -5');
    await applyChanges(
      db,
      changes({
        shopInventory: [
          { shopId: SHOP, productId: WIG, quantity: 7, reorderLevel: 1, priceOverride: null, effectivePrice: '980.00', wholesalePriceOverride: null, effectiveWholesalePrice: '800.00', wholesaleMinQuantity: 3, lowStock: false, oversold: false, updatedAt: T },
        ],
      }),
    );
    const inv = await db.getFirstAsync<{ quantity: number; effectivePrice: string }>('SELECT quantity, effectivePrice FROM shopInventory');
    expect(inv).toEqual({ quantity: 7, effectivePrice: '980.00' });
  });
});
