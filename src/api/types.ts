/**
 * Wire shapes from ../moria-enterprise-backend/docs/_components.yaml. That is
 * the authority; keep these in step with it. Money fields are 2-dp strings.
 */
import type { Money } from '@/lib/money';

export type Role = 'owner' | 'salesperson';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  /** Required for a salesperson, always null for an owner. */
  shopId: string | null;
  shop?: { id: string; name: string } | null;
  isActive: boolean;
  /** While true every endpoint except /auth/password, /auth/me, /auth/logout answers PASSWORD_CHANGE_REQUIRED. */
  mustChangePassword: boolean;
  hasPin: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  user: User;
}

export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface Shop {
  id: string;
  name: string;
  location: string | null;
  momoNumber: string | null;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  barcode: string | null;
  defaultPrice: Money;
  wholesalePrice: Money | null;
  wholesaleMinQuantity: number | null;
  /** Owner only — absent for a salesperson on every surface. */
  costPrice?: Money | null;
  coverImageUrl: string | null;
  coverImageKey: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * A shop's stock row as `GET /sync/changes` sends it: the raw table row.
 * The device resolves prices itself (src/db/catalog.ts). The resolved fields
 * appear on the inventory endpoints and are optional here.
 */
export interface InventoryRow {
  shopId: string;
  productId: string;
  /** Cached; may go negative (offline oversell). */
  quantity: number;
  reorderLevel: number;
  priceOverride: Money | null;
  wholesalePriceOverride: Money | null;
  updatedAt: string;
  effectivePrice?: Money;
  effectiveWholesalePrice?: Money | null;
  wholesaleMinQuantity?: number | null;
  lowStock?: boolean;
  oversold?: boolean;
}

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  address: string | null;
  smsOptIn: boolean;
  optedOutAt: string | null;
  smsSubscribed?: boolean;
  creditEligible?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type SaleType = 'fullPayment' | 'credit';
export type PaymentMethod = 'cash' | 'momo';
export type PriceTier = 'retail' | 'wholesale';
export type MovementType = 'restock' | 'sale' | 'return' | 'adjustment';

export interface SaleSummary {
  id: string;
  shopId: string;
  userId: string;
  customerId: string | null;
  saleType: SaleType;
  totalAmount: Money;
  dueDate: string | null;
  status: 'completed' | 'voided';
  voidReason: string | null;
  voidedAt: string | null;
  note: string | null;
  deviceRecordedAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  saleId: string;
  shopId: string;
  /** Negative only on a void's reversal. */
  amount: Money;
  method: PaymentMethod;
  momoReference: string | null;
  reversesPaymentId: string | null;
  receivedBy: string;
  deviceRecordedAt: string;
  updatedAt?: string;
}

/** A row of the server's `debts` view: one open credit sale. */
export interface Debt {
  saleId: string;
  shopId: string;
  shop?: { id: string; name: string } | null;
  customerId: string;
  customer?: { id: string; phone: string; name: string | null; address: string | null } | null;
  totalAmount: Money;
  amountPaid: Money;
  amountReturned: Money;
  /** Always > 0. */
  balance: Money;
  dueDate: string;
  overdue: boolean;
  lastPaymentAt: string | null;
  saleRecordedAt: string;
  note: string | null;
}
