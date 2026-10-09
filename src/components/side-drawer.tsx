import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { User } from '@/api/types';
import { Icon } from '@/components/ui/icon';
import { Logo } from '@/components/ui/logo';
import { Text } from '@/components/ui/text';
import { NAV_ITEMS } from '@/navigation/nav-items';
import { colors, fonts, radius } from '@/theme/tokens';

export function SideDrawer({
  open,
  user,
  onClose,
  onNavigate,
  onSignOut,
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onNavigate: (route: string) => void;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isOwner = user.role === 'owner';
  const shopName = user.shop?.name ?? (isOwner ? 'All shops' : '—');

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
        <View style={[styles.drawer, { paddingBottom: insets.bottom }]}>
          <View style={[styles.head, { paddingTop: insets.top + 24 }]}>
            <Logo height={40} plate={false} />
            <Text style={{ marginTop: 12 }} color={colors.white}>
              {user.name}
            </Text>
            <Text style={styles.role} color="rgba(255,255,255,0.6)">
              {user.role} · {shopName}
            </Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 8 }}>
            {NAV_ITEMS.filter((i) => !i.ownerOnly || isOwner).map((item) => (
              <Pressable
                key={item.route}
                onPress={() => onNavigate(item.route)}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: 'rgba(243,232,245,0.5)' }]}>
                <Icon name={item.icon} color={colors.onSurfaceVariant} />
                <Text style={styles.itemLabel} color={colors.onSurfaceVariant}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onSignOut} style={styles.signOut}>
            <Icon name="logout" size={18} />
            <Text style={styles.itemLabel} color={colors.regalPlum}>
              Sign Out
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(45,10,49,0.4)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 288, backgroundColor: colors.white },
  head: { padding: 24, backgroundColor: colors.regalPlum },
  role: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 14 },
  itemLabel: { fontFamily: fonts.sansSemi, fontSize: 14 },
  signOut: {
    margin: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
    borderRadius: radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
});
