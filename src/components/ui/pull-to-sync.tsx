import { useEffect, useState } from 'react';
import { RefreshControl } from 'react-native';

import { useSyncStore } from '@/sync/sync-store';
import { colors } from '@/theme/tokens';

/**
 * Pull-to-refresh that syncs. The spinner follows the user's own pull only:
 * driving `refreshing` from background syncs (on entry, every two minutes)
 * left Android's RefreshControl intercepting every tap in the list.
 */
export function usePullToSync() {
  const { phase, requestSync } = useSyncStore();
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    if (pulling && phase !== 'syncing') {
      const t = setTimeout(() => setPulling(false), 0);
      return () => clearTimeout(t);
    }
  }, [pulling, phase]);

  return (
    <RefreshControl
      refreshing={pulling}
      onRefresh={() => {
        setPulling(true);
        requestSync?.();
      }}
      tintColor={colors.regalPlum}
      colors={[colors.regalPlum]}
    />
  );
}
