import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import { useSession } from '@/auth/session-store';
import { getMeta, setMeta } from '@/db/meta';
import { listActiveShops } from '@/db/shops';

/**
 * The owner's working shop: one deliberate choice, made in the side drawer,
 * that Sales and Inventory follow. It is saved on the device so it survives
 * restarts and syncs, and changes only when the owner picks another — or when
 * the saved shop no longer exists or has been closed.
 *
 * A salesperson has no choice: their shop comes from their account.
 */
interface ActiveShopState {
  shopId: string | null;
  hydrated: boolean;
  /** Load the saved choice; if it is missing or no longer an open shop, fall back to the first one. */
  reconcile(db: SQLiteDatabase): Promise<void>;
  choose(db: SQLiteDatabase, shopId: string): Promise<void>;
}

export const useActiveShopStore = create<ActiveShopState>()((set, get) => ({
  shopId: null,
  hydrated: false,

  async reconcile(db) {
    const [saved, shops] = await Promise.all([getMeta(db, 'activeShopId'), listActiveShops(db)]);
    const current = get().shopId ?? saved;
    if (current && shops.some((s) => s.id === current)) {
      set({ shopId: current, hydrated: true });
      if (current !== saved) await setMeta(db, 'activeShopId', current);
      return;
    }
    const fallback = shops[0]?.id ?? null;
    set({ shopId: fallback, hydrated: true });
    await setMeta(db, 'activeShopId', fallback);
  },

  async choose(db, shopId) {
    set({ shopId });
    await setMeta(db, 'activeShopId', shopId);
  },
}));

/** The shop Sales and Inventory work in: the owner's choice, or the salesperson's own. */
export function useActiveShopId(): string | null {
  const user = useSession((s) => s.user);
  const chosen = useActiveShopStore((s) => s.shopId);
  if (!user) return null;
  return user.role === 'owner' ? chosen : user.shopId;
}
