import type { SQLiteDatabase } from 'expo-sqlite';

import type { PricedProduct } from '@/pos/pricing';

export interface PosProduct extends PricedProduct {
  id: string;
  name: string;
  barcode: string | null;
  categoryId: string;
  coverImageUrl: string | null;
  /** Null when this shop has no stock row yet ("catalog only"). */
  quantity: number | null;
  reorderLevel: number;
}

export interface PosCategory {
  id: string;
  name: string;
}

/**
 * Same rule as the API's inventory list: quantity at or below the reorder
 * level. A product with no stock row in this shop has never been stocked
 * here; the API's low-stock list leaves it out, so it gets no badge.
 */
export function stockFlags(p: Pick<PosProduct, 'quantity' | 'reorderLevel'>) {
  if (p.quantity === null) return { oversold: false, lowStock: false, stocked: false };
  return { oversold: p.quantity < 0, lowStock: p.quantity >= 0 && p.quantity <= p.reorderLevel, stocked: true };
}

export type StockFilter = 'all' | 'low' | 'oversold';

/** The Stock Levels list: every sellable product with this shop's figures, filtered by state. */
export async function listInventory(
  db: SQLiteDatabase,
  shopId: string,
  { filter = 'all', search }: { filter?: StockFilter; search?: string } = {},
): Promise<PosProduct[]> {
  const rows = await listPosProducts(db, shopId, { search });
  if (filter === 'all') return rows;
  return rows.filter((p) => (filter === 'low' ? stockFlags(p).lowStock : stockFlags(p).oversold));
}

/**
 * Sellable products with this shop's stock and prices. Hidden: inactive or
 * deleted products, and products in an inactive category (as the public
 * catalogue does).
 */
export async function listPosProducts(
  db: SQLiteDatabase,
  shopId: string,
  { search, categoryId }: { search?: string; categoryId?: string | null } = {},
): Promise<PosProduct[]> {
  const where = ['p.isActive = 1', 'p.deletedAt IS NULL', 'c.isActive = 1', 'c.deletedAt IS NULL'];
  const params: (string | number)[] = [shopId];
  if (categoryId) {
    where.push('p.categoryId = ?');
    params.push(categoryId);
  }
  const q = search?.trim();
  if (q) {
    where.push(`(p.name LIKE ? ESCAPE '\\' OR p.barcode LIKE ? ESCAPE '\\')`);
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    params.push(like, like);
  }
  return db.getAllAsync<PosProduct>(
    `SELECT p.id, p.name, p.barcode, p.categoryId, p.coverImageUrl,
            -- Same resolution as the API's effectivePrice / resolveWholesale.
            COALESCE(i.priceOverride, p.defaultPrice) AS retailPrice,
            CASE WHEN p.wholesaleMinQuantity IS NULL THEN NULL
                 ELSE COALESCE(i.wholesalePriceOverride, p.wholesalePrice) END AS wholesalePrice,
            p.wholesaleMinQuantity AS wholesaleMinQuantity,
            i.quantity AS quantity,
            COALESCE(i.reorderLevel, 0) AS reorderLevel
     FROM products p
     JOIN categories c ON c.id = p.categoryId
     LEFT JOIN shopInventory i ON i.productId = p.id AND i.shopId = ?
     WHERE ${where.join(' AND ')}
     ORDER BY p.name COLLATE NOCASE`,
    ...params,
  );
}

export function listPosCategories(db: SQLiteDatabase): Promise<PosCategory[]> {
  return db.getAllAsync<PosCategory>(
    'SELECT id, name FROM categories WHERE isActive = 1 AND deletedAt IS NULL ORDER BY name COLLATE NOCASE',
  );
}
