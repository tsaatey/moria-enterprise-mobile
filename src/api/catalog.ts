/**
 * Catalog writes (owner only). These are online: § Offline Sync Protocol
 * pushes sales, payments, customers and stock movements — not catalog edits,
 * which the owner makes and every device then pulls.
 */
import type { Money } from '@/lib/money';

import { api } from './client';
import type { Category, Product } from './types';

export interface ProductInput {
  categoryId: string;
  name: string;
  description?: string | null;
  barcode?: string | null;
  defaultPrice: Money;
  costPrice?: Money | null;
  wholesalePrice?: Money | null;
  wholesaleMinQuantity?: number | null;
  /** A confirmed attachment in `productCovers`; null clears the cover on update. */
  coverImageAttachmentId?: string | null;
  isActive?: boolean;
}

export const createProduct = (body: ProductInput) => api<Product>('/products', { method: 'POST', body });

export const updateProduct = (id: string, body: Partial<ProductInput> & { coverImageUrl?: null; coverImageKey?: null }) =>
  api<Product>(`/products/${id}`, { method: 'PATCH', body });

export const listCategories = () => api<Category[]>('/categories');

/** Per-shop settings; creates the stock row at quantity 0 if the shop has none yet. */
export const setShopInventory = (shopId: string, productId: string, body: { reorderLevel?: number }) =>
  api<unknown>(`/shops/${shopId}/inventory/${productId}`, { method: 'PATCH', body });
