import { api } from './client';
import type { Debt, Paginated } from './types';

const PAGE = 100;

/**
 * Every open debt the caller may see (a salesperson: their own shop). The
 * list is paginated (max 100 per page), so walk the pages.
 */
export async function listAllDebts(): Promise<Debt[]> {
  const rows: Debt[] = [];
  for (let page = 1; ; page++) {
    const res = await api<Paginated<Debt>>('/debts', { query: { page, limit: PAGE } });
    rows.push(...res.data);
    if (page >= res.pagination.totalPages) return rows;
  }
}
