import { getMeta } from '@/db/meta';
import { migrateDbIfNeeded } from '@/db/schema';
import { saveShops } from '@/db/shops';
import { useActiveShopStore } from '@/shop/active-shop';

import { memoryDb } from './helpers/memory-db';

jest.mock('@/auth/session-store', () => ({ useSession: jest.fn() }));

const shop = (id: string, name: string, isActive = true) => ({ id, name, location: null, momoNumber: null, isActive });
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

async function db() {
  const d = memoryDb();
  await migrateDbIfNeeded(d);
  await saveShops(d, [shop(A, 'Airport City'), shop(B, 'East Legon')]);
  return d;
}

beforeEach(() => useActiveShopStore.setState({ shopId: null, hydrated: false }));

it('defaults to the first open shop only when nothing was chosen', async () => {
  const d = await db();
  await useActiveShopStore.getState().reconcile(d);
  expect(useActiveShopStore.getState().shopId).toBe(A);
});

it('keeps a deliberate choice across syncs and restarts', async () => {
  const d = await db();
  await useActiveShopStore.getState().choose(d, B);
  await useActiveShopStore.getState().reconcile(d); // a sync
  expect(useActiveShopStore.getState().shopId).toBe(B);

  useActiveShopStore.setState({ shopId: null, hydrated: false }); // app restart
  await useActiveShopStore.getState().reconcile(d);
  expect(useActiveShopStore.getState().shopId).toBe(B);
  expect(await getMeta(d, 'activeShopId')).toBe(B);
});

it('falls back when the chosen shop is closed', async () => {
  const d = await db();
  await useActiveShopStore.getState().choose(d, B);
  await saveShops(d, [shop(B, 'East Legon', false)]);
  await useActiveShopStore.getState().reconcile(d);
  expect(useActiveShopStore.getState().shopId).toBe(A);
});
