/**
 * Owner dashboard reads — docs/dashboard.yaml in the backend. All are live
 * aggregates over Postgres (§ Data Flow 4), so the dashboard needs a
 * connection; the screen keeps the last good copy for offline viewing.
 */
import type { Money } from '@/lib/money';

import { api } from './client';
import type { Paginated, SaleItem, SaleSummary } from './types';

export interface DashboardSummary {
  totals: {
    revenue: Money;
    creditExtended: Money;
    transactionCount: number;
    itemsSold: number;
    voidCount: number;
    amountReversed: Money;
    shopCount: number;
  };
  shops: {
    shopId: string;
    shopName: string;
    isActive: boolean;
    revenue: Money;
    transactionCount: number;
    itemsSold: number;
    creditExtended: Money;
  }[];
}

export interface DashboardStockRow {
  shopId: string;
  shopName: string;
  productId: string;
  productName: string;
  quantity: number;
  reorderLevel: number;
  oversold: boolean;
}

export interface DashboardStock {
  totals: { productCount: number; oversoldCount?: number; unitsShort?: number };
  data: DashboardStockRow[];
}

export interface DashboardDebts {
  totals: { outstanding: Money; overdueAmount: Money; debtCount: number; overdueCount: number };
}

export interface SaleDetail extends SaleSummary {
  items: SaleItem[];
}

export const getSummary = () => api<DashboardSummary>('/dashboard/summary');
export const getLowStock = () => api<DashboardStock>('/dashboard/low-stock', { query: { limit: 20 } });
export const getOversold = () => api<DashboardStock>('/dashboard/oversold', { query: { limit: 20 } });
export const getDebts = () => api<DashboardDebts>('/dashboard/debts', { query: { limit: 1 } });

/**
 * The latest sales with their lines. The list endpoint leaves items out on
 * purpose, so the few rows the dashboard shows are fetched in detail.
 */
export async function getRecentSales(limit = 5): Promise<SaleDetail[]> {
  const list = await api<Paginated<SaleSummary>>('/sales', { query: { status: 'completed', limit } });
  return Promise.all(list.data.map((s) => api<SaleDetail>(`/sales/${s.id}`)));
}
