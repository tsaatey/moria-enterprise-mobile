import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Local SQLite mirror of the backend tables the device needs offline.
 *
 * - Column names are camelCase, matching the API, so rows map 1:1.
 * - Money is TEXT ("450.00"), never REAL.
 * - Rows the device can create offline carry `syncStatus`:
 *     pending  — written locally, not yet accepted by the server
 *     synced   — accepted by a push, or arrived from a pull
 *     rejected — the server refused it (`syncErrorCode`); stays on the device
 *                until corrected, then goes back to pending.
 *
 * Migrations are append-only. Never edit a shipped step — add a new one.
 */
const MIGRATIONS: string[] = [
  // 1 — initial schema
  `
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );

  CREATE TABLE categories (
    id        TEXT PRIMARY KEY NOT NULL,
    name      TEXT NOT NULL,
    isActive  INTEGER NOT NULL DEFAULT 1,
    updatedAt TEXT,
    deletedAt TEXT
  );

  CREATE TABLE products (
    id                   TEXT PRIMARY KEY NOT NULL,
    categoryId           TEXT NOT NULL,
    name                 TEXT NOT NULL,
    description          TEXT,
    barcode              TEXT,
    defaultPrice         TEXT NOT NULL,
    wholesalePrice       TEXT,
    wholesaleMinQuantity INTEGER,
    costPrice            TEXT,
    coverImageUrl        TEXT,
    isActive             INTEGER NOT NULL DEFAULT 1,
    updatedAt            TEXT,
    deletedAt            TEXT
  );
  CREATE INDEX products_category ON products (categoryId);
  CREATE INDEX products_name ON products (name COLLATE NOCASE);

  CREATE TABLE shopInventory (
    shopId                  TEXT NOT NULL,
    productId               TEXT NOT NULL,
    quantity                INTEGER NOT NULL DEFAULT 0,
    reorderLevel            INTEGER NOT NULL DEFAULT 0,
    priceOverride           TEXT,
    effectivePrice          TEXT NOT NULL,
    wholesalePriceOverride  TEXT,
    effectiveWholesalePrice TEXT,
    wholesaleMinQuantity    INTEGER,
    updatedAt               TEXT,
    PRIMARY KEY (shopId, productId)
  );

  CREATE TABLE customers (
    id              TEXT PRIMARY KEY NOT NULL,
    phone           TEXT NOT NULL,
    name            TEXT,
    address         TEXT,
    smsOptIn        INTEGER NOT NULL DEFAULT 1,
    optedOutAt      TEXT,
    createdBy       TEXT,
    updatedAt       TEXT,
    deletedAt       TEXT,
    syncStatus      TEXT NOT NULL DEFAULT 'synced',
    syncErrorCode   TEXT,
    syncErrorMessage TEXT
  );
  -- Not UNIQUE: the server merges by phone and returns a remap; locally two
  -- rows may briefly share a phone until that remap is applied.
  CREATE INDEX customers_phone ON customers (phone);

  CREATE TABLE sales (
    id               TEXT PRIMARY KEY NOT NULL,
    shopId           TEXT NOT NULL,
    userId           TEXT,
    customerId       TEXT,
    saleType         TEXT NOT NULL,
    totalAmount      TEXT NOT NULL,
    dueDate          TEXT,
    status           TEXT NOT NULL DEFAULT 'completed',
    voidReason       TEXT,
    voidedAt         TEXT,
    note             TEXT,
    deviceRecordedAt TEXT NOT NULL,
    updatedAt        TEXT,
    syncStatus       TEXT NOT NULL DEFAULT 'synced',
    syncErrorCode    TEXT,
    syncErrorMessage TEXT
  );
  CREATE INDEX sales_shop_time ON sales (shopId, deviceRecordedAt);
  CREATE INDEX sales_customer ON sales (customerId);

  CREATE TABLE saleItems (
    id        TEXT PRIMARY KEY NOT NULL,
    saleId    TEXT NOT NULL,
    productId TEXT NOT NULL,
    quantity  INTEGER NOT NULL,
    unitPrice TEXT NOT NULL,
    subtotal  TEXT NOT NULL,
    priceTier TEXT NOT NULL DEFAULT 'retail'
  );
  CREATE INDEX saleItems_sale ON saleItems (saleId);

  -- atCheckout = 1: taken at the till, pushed nested inside its sale.
  -- atCheckout = 0: a later debt instalment, pushed as a standalone payment.
  CREATE TABLE payments (
    id                TEXT PRIMARY KEY NOT NULL,
    saleId            TEXT NOT NULL,
    shopId            TEXT,
    amount            TEXT NOT NULL,
    method            TEXT NOT NULL,
    momoReference     TEXT,
    reversesPaymentId TEXT,
    receivedBy        TEXT,
    atCheckout        INTEGER NOT NULL DEFAULT 0,
    deviceRecordedAt  TEXT NOT NULL,
    syncStatus        TEXT NOT NULL DEFAULT 'synced',
    syncErrorCode     TEXT,
    syncErrorMessage  TEXT
  );
  CREATE INDEX payments_sale ON payments (saleId);

  CREATE TABLE stockMovements (
    id               TEXT PRIMARY KEY NOT NULL,
    shopId           TEXT NOT NULL,
    productId        TEXT NOT NULL,
    movementType     TEXT NOT NULL,
    quantityChange   INTEGER NOT NULL,
    reason           TEXT,
    saleId           TEXT,
    deviceRecordedAt TEXT NOT NULL,
    syncStatus       TEXT NOT NULL DEFAULT 'pending',
    syncErrorCode    TEXT,
    syncErrorMessage TEXT
  );
  `,

  // 2 — who recorded each offline row, so a queue never pushes under another
  // user's token (the server takes userId / receivedBy / createdBy from the
  // JWT). sales.userId, payments.receivedBy and customers.createdBy already
  // exist; stock movements need the column. Plus the shop list for the
  // owner's shop picker.
  `
  ALTER TABLE stockMovements ADD COLUMN userId TEXT;
  CREATE INDEX sales_pending_user ON sales (syncStatus, userId);
  CREATE INDEX payments_pending_user ON payments (syncStatus, receivedBy);
  CREATE INDEX customers_pending_user ON customers (syncStatus, createdBy);
  CREATE INDEX stockMovements_pending_user ON stockMovements (syncStatus, userId);

  CREATE TABLE shops (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    location   TEXT,
    momoNumber TEXT,
    isActive   INTEGER NOT NULL DEFAULT 1
  );
  `,
];

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current === 0) {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  }

  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      // PRAGMA cannot take a bound parameter; version is our own integer.
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

export const DATABASE_NAME = 'moria.db';
