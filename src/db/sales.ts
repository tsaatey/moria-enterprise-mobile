import type { SQLiteDatabase } from 'expo-sqlite';

import type { PaymentMethod, PriceTier, SaleType } from '@/api/types';
import { nowIso } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { type Money, sumMoney } from '@/lib/money';

export interface NewSaleLine {
  productId: string;
  quantity: number;
  unitPrice: Money;
  subtotal: Money;
  priceTier: PriceTier;
  /** For a shop with no stock row yet: the price that row would start at. */
  retailPrice: Money;
}

export interface NewSale {
  shopId: string;
  userId: string;
  saleType: SaleType;
  customerId: string | null;
  /** Required for credit, null otherwise. */
  dueDate: string | null;
  lines: NewSaleLine[];
  /** At the till: the full total for fullPayment, an optional deposit for credit. */
  payment: { amount: Money; method: PaymentMethod; momoReference: string | null } | null;
  note?: string | null;
}

/**
 * Record a sale locally — complete from the shop's point of view the moment
 * this resolves (§ Data Flow 1). One transaction: the sale, its lines, any
 * payment taken at the till, and an optimistic stock decrement. The next pull
 * replaces that stock figure with the server's.
 */
export async function recordSale(db: SQLiteDatabase, sale: NewSale): Promise<{ id: string; totalAmount: Money }> {
  const id = newId();
  const at = nowIso();
  const totalAmount = sumMoney(sale.lines.map((l) => l.subtotal));

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO sales (id, shopId, userId, customerId, saleType, totalAmount, dueDate, status, note,
         deviceRecordedAt, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, 'pending')`,
      id,
      sale.shopId,
      sale.userId,
      sale.customerId,
      sale.saleType,
      totalAmount,
      sale.saleType === 'credit' ? sale.dueDate : null,
      sale.note ?? null,
      at,
      at,
    );

    for (const line of sale.lines) {
      await txn.runAsync(
        `INSERT INTO saleItems (id, saleId, productId, quantity, unitPrice, subtotal, priceTier)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        newId(),
        id,
        line.productId,
        line.quantity,
        line.unitPrice,
        line.subtotal,
        line.priceTier,
      );
      // Mirrors the server: a sale in a shop with no stock row creates one.
      await txn.runAsync(
        `INSERT INTO shopInventory (shopId, productId, quantity, reorderLevel, effectivePrice, updatedAt)
         VALUES (?, ?, ?, 0, ?, ?)
         ON CONFLICT (shopId, productId) DO UPDATE SET quantity = shopInventory.quantity + excluded.quantity`,
        sale.shopId,
        line.productId,
        -line.quantity,
        line.retailPrice,
        at,
      );
    }

    if (sale.payment) {
      await txn.runAsync(
        `INSERT INTO payments (id, saleId, shopId, amount, method, momoReference, receivedBy, atCheckout,
           deviceRecordedAt, syncStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'pending')`,
        newId(),
        id,
        sale.shopId,
        sale.payment.amount,
        sale.payment.method,
        sale.payment.method === 'momo' ? sale.payment.momoReference?.trim() || null : null,
        sale.userId,
        at,
      );
    }
  });

  return { id, totalAmount };
}
