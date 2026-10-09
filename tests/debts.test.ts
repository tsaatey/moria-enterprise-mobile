import { getOpenDebts, recordDebtPayment, saveDebts } from '@/db/debts';
import { recordSale } from '@/db/sales';
import { migrateDbIfNeeded } from '@/db/schema';
import { listSyncIssues, requeue } from '@/db/sync-issues';
import { collectPending } from '@/sync/push';

import { memoryDb } from './helpers/memory-db';

const SHOP = '11111111-1111-4111-8111-111111111111';
const AMA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUST = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SALE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const debt = (over: Partial<Parameters<typeof saveDebts>[1][number]> = {}) => ({
  saleId: SALE,
  shopId: SHOP,
  shop: { id: SHOP, name: 'East Legon' },
  customerId: CUST,
  totalAmount: '1000.00',
  amountPaid: '200.00',
  amountReturned: '0.00',
  balance: '800.00',
  dueDate: '2020-01-01',
  overdue: true,
  lastPaymentAt: null,
  saleRecordedAt: '2019-12-01T10:00:00.000Z',
  note: null,
  ...over,
});

async function freshDb() {
  const db = memoryDb();
  await migrateDbIfNeeded(db);
  return db;
}

it("shows the server's balance less instalments it has not seen yet", async () => {
  const db = await freshDb();
  await saveDebts(db, [debt()]);
  await recordDebtPayment(db, { saleId: SALE, shopId: SHOP, amount: '300', method: 'cash', momoReference: 'x', receivedBy: AMA });

  const [d] = await getOpenDebts(db);
  expect(d).toMatchObject({ saleId: SALE, balance: '500.00', overdue: true, provisional: true, shopName: 'East Legon' });

  const batch = await collectPending(db, { deviceId: 'dev', userId: AMA, role: 'salesperson' });
  expect(batch.payments).toEqual([
    expect.objectContaining({ saleId: SALE, amount: '300.00', method: 'cash', momoReference: null }),
  ]);
});

it('drops a debt once local instalments settle it', async () => {
  const db = await freshDb();
  await saveDebts(db, [debt()]);
  await recordDebtPayment(db, { saleId: SALE, shopId: SHOP, amount: '800.00', method: 'momo', momoReference: 'MP9', receivedBy: AMA });
  expect(await getOpenDebts(db)).toEqual([]);
});

it('includes an unsynced credit sale, net of its deposit, ordered overdue first', async () => {
  const db = await freshDb();
  await saveDebts(db, [debt({ dueDate: '2099-01-01', overdue: false })]);
  const { id } = await recordSale(db, {
    shopId: SHOP,
    userId: AMA,
    saleType: 'credit',
    customerId: CUST,
    dueDate: '2000-06-01',
    lines: [{ productId: 'p', quantity: 1, unitPrice: '450.00', subtotal: '450.00', priceTier: 'retail', retailPrice: '450.00' }],
    payment: { amount: '100.00', method: 'cash', momoReference: null },
  });

  const debts = await getOpenDebts(db, { customerId: CUST });
  expect(debts.map((d) => [d.saleId, d.balance, d.overdue, d.provisional])).toEqual([
    [id, '350.00', true, true],
    [SALE, '800.00', false, false],
  ]);
});

it('lists a rejected credit sale and requeues it with its customer and deposit', async () => {
  const db = await freshDb();
  await db.runAsync(
    `INSERT INTO customers (id, phone, name, address, createdBy, syncStatus) VALUES (?, '0244000000', NULL, NULL, ?, 'synced')`,
    CUST,
    AMA,
  );
  const { id } = await recordSale(db, {
    shopId: SHOP,
    userId: AMA,
    saleType: 'credit',
    customerId: CUST,
    dueDate: '2099-01-01',
    lines: [{ productId: 'p', quantity: 1, unitPrice: '450.00', subtotal: '450.00', priceTier: 'retail', retailPrice: '450.00' }],
    payment: { amount: '100.00', method: 'cash', momoReference: null },
  });
  await db.runAsync(`UPDATE sales SET syncStatus = 'rejected', syncErrorCode = 'CUSTOMER_INCOMPLETE', syncErrorMessage = 'needs name' WHERE id = ?`, id);
  await db.runAsync(`UPDATE payments SET syncStatus = 'rejected' WHERE saleId = ?`, id);

  const [issue] = await listSyncIssues(db, AMA);
  expect(issue).toMatchObject({ type: 'sale', id, code: 'CUSTOMER_INCOMPLETE', customerId: CUST, customerLabel: '0244000000' });
  expect((await collectPending(db, { deviceId: 'dev', userId: AMA, role: 'salesperson' })).sales).toEqual([]);

  await db.runAsync(`UPDATE customers SET name = 'Ama', address = 'Lapaz' WHERE id = ?`, CUST);
  await requeue(db, issue);

  const batch = await collectPending(db, { deviceId: 'dev', userId: AMA, role: 'salesperson' });
  expect(batch.sales.map((s) => [s.id, s.payments.length])).toEqual([[id, 1]]);
  expect(batch.customers).toEqual([expect.objectContaining({ id: CUST, name: 'Ama', address: 'Lapaz' })]);
  expect(await listSyncIssues(db, AMA)).toEqual([]);
});
