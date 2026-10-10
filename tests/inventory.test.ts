import { applyChanges } from '@/sync/pull';
import { listInventory, stockFlags } from '@/db/catalog';
import { migrateDbIfNeeded } from '@/db/schema';
import { recordRestock } from '@/db/stock';
import { collectPending } from '@/sync/push';

import { memoryDb } from './helpers/memory-db';

const SHOP = '11111111-1111-4111-8111-111111111111';
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const T = '2026-10-10T08:00:00.000Z';
const product = (id: string, name: string) => ({
  id,
  categoryId: CAT,
  name,
  description: null,
  barcode: null,
  defaultPrice: '100.00',
  wholesalePrice: null,
  wholesaleMinQuantity: null,
  coverImageUrl: null,
  coverImageKey: null,
  isActive: true,
  createdAt: T,
  updatedAt: T,
  deletedAt: null,
});
const stock = (productId: string, quantity: number, reorderLevel: number) => ({
  shopId: SHOP,
  productId,
  quantity,
  reorderLevel,
  priceOverride: null,
  wholesalePriceOverride: null,
  updatedAt: T,
});

async function seeded() {
  const db = memoryDb();
  await migrateDbIfNeeded(db);
  await applyChanges(db, {
    serverTime: T,
    changes: {
      categories: [{ id: CAT, name: 'Wigs', isActive: true, createdAt: T, updatedAt: T, deletedAt: null }],
      products: [
        product('10000000-0000-4000-8000-000000000001', 'Healthy'),
        product('10000000-0000-4000-8000-000000000002', 'Low'),
        product('10000000-0000-4000-8000-000000000003', 'Oversold'),
        product('10000000-0000-4000-8000-000000000004', 'Never stocked'),
      ],
      shopInventory: [
        stock('10000000-0000-4000-8000-000000000001', 20, 5),
        stock('10000000-0000-4000-8000-000000000002', 3, 5),
        stock('10000000-0000-4000-8000-000000000003', -2, 5),
      ],
      customers: [],
    },
  });
  return db;
}

it('filters Low Stock and Oversold, and never flags a product the shop has not stocked', async () => {
  const db = await seeded();
  expect((await listInventory(db, SHOP, { filter: 'low' })).map((p) => p.name)).toEqual(['Low']);
  expect((await listInventory(db, SHOP, { filter: 'oversold' })).map((p) => p.name)).toEqual(['Oversold']);
  const never = (await listInventory(db, SHOP)).find((p) => p.name === 'Never stocked')!;
  expect(stockFlags(never)).toEqual({ oversold: false, lowStock: false, stocked: false });
});

it('records a restock offline: stock moves at once and the movement is queued for the owner only', async () => {
  const db = await seeded();
  await recordRestock(db, { shopId: SHOP, productId: '10000000-0000-4000-8000-000000000003', quantity: 12, reason: ' Delivery ', userId: OWNER });
  await recordRestock(db, { shopId: SHOP, productId: '10000000-0000-4000-8000-000000000004', quantity: 6, reason: null, userId: OWNER });

  const rows = await listInventory(db, SHOP);
  expect(rows.find((p) => p.name === 'Oversold')!.quantity).toBe(10);
  expect(rows.find((p) => p.name === 'Never stocked')!.quantity).toBe(6);

  const owner = await collectPending(db, { deviceId: 'dev', userId: OWNER, role: 'owner' });
  expect(owner.stockMovements).toEqual([
    expect.objectContaining({ movementType: 'restock', quantityChange: 12, reason: 'Delivery', saleId: null, shopId: SHOP }),
    expect.objectContaining({ movementType: 'restock', quantityChange: 6, reason: null }),
  ]);
  // The API refuses movements from a salesperson, so their push never carries them.
  const sales = await collectPending(db, { deviceId: 'dev', userId: OWNER, role: 'salesperson' });
  expect(sales.stockMovements).toEqual([]);
});

it('refuses a restock of zero or fewer units', async () => {
  const db = await seeded();
  await expect(
    recordRestock(db, { shopId: SHOP, productId: '10000000-0000-4000-8000-000000000001', quantity: 0, reason: null, userId: OWNER }),
  ).rejects.toThrow();
});
