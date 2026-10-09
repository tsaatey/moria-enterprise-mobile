import { create } from 'zustand';

import type { PosProduct } from '@/db/catalog';
import { type Money, sumMoney } from '@/lib/money';

import { type LinePrice, priceLine } from './pricing';

export interface CartLine {
  product: PosProduct;
  quantity: number;
}

interface CartState {
  /** The selling shop. Fixed for a salesperson; the owner picks one (prices and stock are per shop). */
  shopId: string | null;
  lines: CartLine[];
  setShop(shopId: string | null): void;
  add(product: PosProduct): void;
  setQuantity(productId: string, quantity: number): void;
  remove(productId: string): void;
  clear(): void;
  /** Swap in fresh product rows (after a sync) so prices stay current. */
  refreshProducts(products: PosProduct[]): void;
}

export const useCart = create<CartState>()((set, get) => ({
  shopId: null,
  lines: [],

  setShop(shopId) {
    if (shopId !== get().shopId) set({ shopId, lines: [] });
  },

  add(product) {
    const lines = get().lines;
    const existing = lines.find((l) => l.product.id === product.id);
    set({
      lines: existing
        ? lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
        : [...lines, { product, quantity: 1 }],
    });
  },

  setQuantity(productId, quantity) {
    if (quantity < 1) return get().remove(productId);
    set({ lines: get().lines.map((l) => (l.product.id === productId ? { ...l, quantity } : l)) });
  },

  remove(productId) {
    set({ lines: get().lines.filter((l) => l.product.id !== productId) });
  },

  clear() {
    set({ lines: [] });
  },

  refreshProducts(products) {
    const byId = new Map(products.map((p) => [p.id, p]));
    set({ lines: get().lines.map((l) => ({ ...l, product: byId.get(l.product.id) ?? l.product })) });
  },
}));

export interface PricedLine extends CartLine, LinePrice {}

export function priceCart(lines: CartLine[]): { lines: PricedLine[]; total: Money; count: number } {
  const priced = lines.map((l) => ({ ...l, ...priceLine(l.product, l.quantity) }));
  return {
    lines: priced,
    total: sumMoney(priced.map((l) => l.subtotal)),
    count: lines.reduce((n, l) => n + l.quantity, 0),
  };
}
