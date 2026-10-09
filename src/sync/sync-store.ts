import { create } from 'zustand';

import { ApiError, NetworkError } from '@/api/errors';

import type { SyncContext } from './engine';
import { countPending, runSync } from './engine';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncState {
  phase: SyncPhase;
  /** The signed-in user's unsent records. */
  pending: number;
  /** Other users' unsent records on this phone; they go up when that user signs in. */
  othersPending: number;
  lastSyncedAt: string | null;
  /** Records the server refused in the last run; they need correcting on the device. */
  lastRejected: number;
  lastError: string | null;
  /** Bumped after every successful sync so screens re-read SQLite. */
  dataVersion: number;
  /** Set by `useAutoSync` while signed in: kick a sync from anywhere (after a sale, pull-to-refresh). */
  requestSync: (() => void) | null;
  sync(ctx: SyncContext): Promise<void>;
  refreshPending(ctx: Pick<SyncContext, 'db' | 'userId'>): Promise<void>;
}

export const useSyncStore = create<SyncState>()((set) => ({
  phase: 'idle',
  pending: 0,
  othersPending: 0,
  lastSyncedAt: null,
  lastRejected: 0,
  lastError: null,
  dataVersion: 0,
  requestSync: null,

  async sync(ctx) {
    set({ phase: 'syncing', lastError: null });
    try {
      const result = await runSync(ctx);
      set((s) => ({
        phase: 'idle',
        lastSyncedAt: result.pulledAt,
        lastRejected: result.rejected,
        dataVersion: s.dataVersion + 1,
      }));
    } catch (e) {
      if (e instanceof NetworkError) set({ phase: 'offline' });
      else {
        const message = e instanceof ApiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
        if (__DEV__) console.warn('[sync] failed:', message, e);
        set({ phase: 'error', lastError: message });
      }
    } finally {
      await useSyncStore.getState().refreshPending(ctx);
    }
  },

  async refreshPending({ db, userId }) {
    // Callers fire and forget (`void sync(...)`), so this must never reject:
    // the database can be closed under it (a dev reload remounting the provider).
    try {
      const { mine, others } = await countPending(db, userId);
      set({ pending: mine, othersPending: others });
    } catch (e) {
      if (__DEV__) console.warn('[sync] could not count pending records:', e);
    }
  },
}));
