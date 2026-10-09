/**
 * Offline sync contract — specification.md § Offline Sync Protocol and
 * docs/sync.yaml in the backend. Agree changes there first.
 */
import type { Money } from '@/lib/money';

import { api } from './client';
import type {
  Category,
  Customer,
  InventoryRow,
  MovementType,
  Payment,
  PaymentMethod,
  PriceTier,
  Product,
  SaleSummary,
  SaleType,
} from './types';

export interface PushCustomer {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  smsOptIn: boolean;
}

export interface PushSaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: Money;
  subtotal: Money;
  priceTier: PriceTier;
}

export interface PushSalePayment {
  id: string;
  amount: Money;
  method: PaymentMethod;
  momoReference: string | null;
  deviceRecordedAt: string;
}

/** Same shape as the `POST /sales` body. */
export interface PushSale {
  id: string;
  shopId: string;
  customerId: string | null;
  saleType: SaleType;
  totalAmount: Money;
  dueDate: string | null;
  note: string | null;
  deviceRecordedAt: string;
  items: PushSaleItem[];
  payments: PushSalePayment[];
}

/** A debt instalment against a sale that already exists. */
export interface PushPayment extends PushSalePayment {
  saleId: string;
}

/** Owner only, and never `sale` — the server derives those from sale items. */
export interface PushStockMovement {
  id: string;
  shopId: string;
  productId: string;
  movementType: Exclude<MovementType, 'sale'>;
  quantityChange: number;
  reason: string | null;
  saleId: string | null;
  deviceRecordedAt: string;
}

export interface PushRequest {
  deviceId: string;
  customers: PushCustomer[];
  sales: PushSale[];
  payments: PushPayment[];
  stockMovements: PushStockMovement[];
}

export type RejectedType = 'customer' | 'sale' | 'payment' | 'stockMovement';

export interface PushResponse {
  accepted: { customers: number; sales: number; payments: number; stockMovements: number };
  customerRemaps: { localId: string; serverId: string }[];
  rejected: { type: RejectedType; id: string | null; code: string; message: string; details?: Record<string, unknown> }[];
  /** Informational on push; the pull cursor comes from `GET /sync/changes`. */
  serverTime: string;
}

export interface ChangesResponse {
  changes: {
    categories: Category[];
    products: Product[];
    shopInventory: InventoryRow[];
    customers: Customer[];
    /** Owner only. Summaries, no items. */
    sales?: SaleSummary[];
    /** Owner only. */
    payments?: Payment[];
  };
  /** Store as the next cursor. Never use the device clock. */
  serverTime: string;
}

/** Per-collection cap in docs/sync.yaml. */
export const PUSH_BATCH_LIMIT = 500;

/** Always 200 — rejections come back per record, not as an HTTP error. */
export function push(body: PushRequest) {
  return api<PushResponse>('/sync/push', { method: 'POST', body });
}

/** Unpaginated by design (OPEN-ITEMS #14). Omit `since` for a first sync. */
export function changes(since: string | null) {
  return api<ChangesResponse>('/sync/changes', { query: { since } });
}
