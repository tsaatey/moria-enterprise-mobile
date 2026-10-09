import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import * as dash from '@/api/dashboard';
import { getMeta, setMeta } from '@/db/meta';
import { errorMessage } from '@/lib/error-message';

export interface DashboardData {
  summary: dash.DashboardSummary;
  lowStock: dash.DashboardStock;
  oversold: dash.DashboardStock;
  debts: dash.DashboardDebts;
  recent: dash.SaleDetail[];
  fetchedAt: string;
}

/**
 * Loads the owner dashboard. The figures are live server aggregates; the
 * last good load is kept in SQLite so the screen still shows something —
 * labelled with its time — when the owner is offline.
 */
export function useDashboard() {
  const db = useSQLiteContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, lowStock, oversold, debts, recent] = await Promise.all([
        dash.getSummary(),
        dash.getLowStock(),
        dash.getOversold(),
        dash.getDebts(),
        dash.getRecentSales(5),
      ]);
      const next = { summary, lowStock, oversold, debts, recent, fetchedAt: new Date().toISOString() };
      setData(next);
      setError(null);
      await setMeta(db, 'dashboardCache', JSON.stringify(next));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    let live = true;
    void getMeta(db, 'dashboardCache').then((raw) => {
      if (live && raw) setData((cur) => cur ?? (JSON.parse(raw) as DashboardData));
    });
    return () => {
      live = false;
    };
  }, [db]);

  return { data, loading, error, load };
}
