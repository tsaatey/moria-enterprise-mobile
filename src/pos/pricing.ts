import type { PriceTier } from '@/api/types';
import { type Money, lineSubtotal, toMoney } from '@/lib/money';

export interface PricedProduct {
  /** The shop's price (`effectivePrice`), else the catalog's `defaultPrice`. */
  retailPrice: Money;
  /** The shop's wholesale override, else the catalog's; null when the product has none. */
  wholesalePrice: Money | null;
  wholesaleMinQuantity: number | null;
}

export interface LinePrice {
  unitPrice: Money;
  subtotal: Money;
  priceTier: PriceTier;
}

/**
 * The wholesale rule (spec § Phasing, decided 2026-10-09): once one sale line
 * reaches `wholesaleMinQuantity` units, every unit on it is charged the
 * wholesale price. Applied by the till itself so it works offline; the server
 * accepts `unitPrice` and `priceTier` as sent.
 */
export function priceLine(product: PricedProduct, quantity: number): LinePrice {
  const wholesale =
    product.wholesalePrice !== null && product.wholesaleMinQuantity !== null && quantity >= product.wholesaleMinQuantity;
  const unitPrice = toMoney(wholesale ? product.wholesalePrice! : product.retailPrice);
  return { unitPrice, subtotal: lineSubtotal(quantity, unitPrice), priceTier: wholesale ? 'wholesale' : 'retail' };
}
