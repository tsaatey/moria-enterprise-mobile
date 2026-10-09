import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Logo } from '@/components/ui/logo';
import { Text } from '@/components/ui/text';
import { useSyncStore } from '@/sync/sync-store';
import { colors, fonts } from '@/theme/tokens';

/** Menu · logo · sync — the prototype's `screen-main` header. */
export function AppHeader({ onMenu, onSync }: { onMenu: () => void; onSync: () => void }) {
  const insets = useSafeAreaInsets();
  const { phase, pending } = useSyncStore();
  const icon = phase === 'offline' ? 'cloud-off' : phase === 'error' ? 'sync-problem' : 'sync';

  return (
    <View style={[styles.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
      <Pressable onPress={onMenu} hitSlop={8} accessibilityLabel="Open menu" style={styles.btn}>
        <Icon name="menu" />
      </Pressable>
      <Logo height={28} />
      <Pressable onPress={onSync} hitSlop={8} accessibilityLabel="Sync now" style={styles.btn}>
        <Icon name={icon} color={phase === 'error' ? colors.error : colors.regalPlum} />
        {pending > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} color={colors.regalPlum}>
              {pending > 99 ? '99+' : pending}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 20,
  },
  btn: { padding: 6 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.monarchGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 9 },
});
