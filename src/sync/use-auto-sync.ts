import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/auth/session-store';

import { useSyncStore } from './sync-store';

const PERIODIC_MS = 2 * 60 * 1000;

/**
 * Sync on: entering the app, reconnecting, returning to the foreground, and
 * every couple of minutes while open. There is no server push (§ Data Flow).
 * Returns a trigger for the header's manual sync button.
 */
export function useAutoSync(): () => void {
  const db = useSQLiteContext();
  const { status, deviceId, user } = useSession();
  const sync = useSyncStore((s) => s.sync);

  const ready = status === 'ready' && !!deviceId && !!user;

  const trigger = useCallback(() => {
    if (ready) void sync({ db, deviceId: deviceId!, userId: user!.id, role: user!.role });
  }, [ready, sync, db, deviceId, user]);

  useEffect(() => {
    useSyncStore.setState({ requestSync: ready ? trigger : null });
  }, [ready, trigger]);

  useEffect(() => {
    if (!ready) return;
    trigger();

    let wasConnected = true;
    const unsubNet = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      if (connected && !wasConnected) trigger();
      wasConnected = connected;
    });
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') trigger();
    });
    const timer = setInterval(trigger, PERIODIC_MS);

    return () => {
      unsubNet();
      appSub.remove();
      clearInterval(timer);
    };
  }, [ready, trigger]);

  return trigger;
}
