import type { SQLiteDatabase } from 'expo-sqlite';

import type { ChangesResponse } from '@/api/sync';

const bool = (v: boolean | undefined | null) => (v ? 1 : 0);

/**
 * Apply a `GET /sync/changes` delta. The catalog is owner-managed, so the
 * server wins there outright. Customers, sales and payments the device has
 * not yet pushed (`pending` / `rejected`) are never overwritten.
 *
 * Catalog removal is `isActive = false` or `deletedAt` set (OPEN-ITEMS #1).
 * Rows are kept so past sale lines still resolve; queries filter them out.
 */
export async function applyChanges(db: SQLiteDatabase, { changes }: ChangesResponse): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const c of changes.categories) {
      await txn.runAsync(
        `INSERT INTO categories (id, name, isActive, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, isActive = excluded.isActive,
           updatedAt = excluded.updatedAt, deletedAt = excluded.deletedAt`,
        c.id,
        c.name,
        bool(c.isActive),
        c.updatedAt,
        c.deletedAt ?? null,
      );
    }

    for (const p of changes.products) {
      await txn.runAsync(
        `INSERT INTO products (id, categoryId, name, description, barcode, defaultPrice, wholesalePrice,
           wholesaleMinQuantity, costPrice, coverImageUrl, isActive, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET categoryId = excluded.categoryId, name = excluded.name,
           description = excluded.description, barcode = excluded.barcode, defaultPrice = excluded.defaultPrice,
           wholesalePrice = excluded.wholesalePrice, wholesaleMinQuantity = excluded.wholesaleMinQuantity,
           costPrice = excluded.costPrice, coverImageUrl = excluded.coverImageUrl, isActive = excluded.isActive,
           updatedAt = excluded.updatedAt, deletedAt = excluded.deletedAt`,
        p.id,
        p.categoryId,
        p.name,
        p.description,
        p.barcode,
        p.defaultPrice,
        p.wholesalePrice,
        p.wholesaleMinQuantity,
        p.costPrice ?? null,
        p.coverImageUrl,
        bool(p.isActive),
        p.updatedAt,
        p.deletedAt ?? null,
      );
    }

    for (const i of changes.shopInventory) {
      await txn.runAsync(
        `INSERT INTO shopInventory (shopId, productId, quantity, reorderLevel, priceOverride, effectivePrice,
           wholesalePriceOverride, effectiveWholesalePrice, wholesaleMinQuantity, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (shopId, productId) DO UPDATE SET quantity = excluded.quantity,
           reorderLevel = excluded.reorderLevel, priceOverride = excluded.priceOverride,
           effectivePrice = excluded.effectivePrice, wholesalePriceOverride = excluded.wholesalePriceOverride,
           effectiveWholesalePrice = excluded.effectiveWholesalePrice,
           wholesaleMinQuantity = excluded.wholesaleMinQuantity, updatedAt = excluded.updatedAt`,
        i.shopId,
        i.productId,
        i.quantity,
        i.reorderLevel,
        i.priceOverride,
        i.effectivePrice,
        i.wholesalePriceOverride,
        i.effectiveWholesalePrice,
        i.wholesaleMinQuantity,
        i.updatedAt,
      );
    }

    for (const c of changes.customers) {
      await txn.runAsync(
        `INSERT INTO customers (id, phone, name, address, smsOptIn, optedOutAt, createdBy, updatedAt, deletedAt, syncStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
         ON CONFLICT (id) DO UPDATE SET phone = excluded.phone, name = excluded.name, address = excluded.address,
           smsOptIn = excluded.smsOptIn, optedOutAt = excluded.optedOutAt, updatedAt = excluded.updatedAt,
           deletedAt = excluded.deletedAt
         WHERE customers.syncStatus = 'synced'`,
        c.id,
        c.phone,
        c.name,
        c.address,
        bool(c.smsOptIn),
        c.optedOutAt,
        c.createdBy,
        c.updatedAt,
        c.deletedAt ?? null,
      );
    }

    // Owner only: sale summaries (no items) and payments, for the dashboard.
    for (const s of changes.sales ?? []) {
      await txn.runAsync(
        `INSERT INTO sales (id, shopId, userId, customerId, saleType, totalAmount, dueDate, status, voidReason,
           voidedAt, note, deviceRecordedAt, updatedAt, syncStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
         ON CONFLICT (id) DO UPDATE SET customerId = excluded.customerId, status = excluded.status,
           voidReason = excluded.voidReason, voidedAt = excluded.voidedAt, updatedAt = excluded.updatedAt
         WHERE sales.syncStatus = 'synced'`,
        s.id,
        s.shopId,
        s.userId,
        s.customerId,
        s.saleType,
        s.totalAmount,
        s.dueDate,
        s.status,
        s.voidReason,
        s.voidedAt,
        s.note,
        s.deviceRecordedAt,
        s.updatedAt,
      );
    }

    for (const p of changes.payments ?? []) {
      await txn.runAsync(
        `INSERT INTO payments (id, saleId, shopId, amount, method, momoReference, reversesPaymentId, receivedBy,
           deviceRecordedAt, syncStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
         ON CONFLICT (id) DO NOTHING`,
        p.id,
        p.saleId,
        p.shopId,
        p.amount,
        p.method,
        p.momoReference,
        p.reversesPaymentId,
        p.receivedBy,
        p.deviceRecordedAt,
      );
    }
  });
}
