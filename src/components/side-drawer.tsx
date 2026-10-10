import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Shop, User } from '@/api/types';
import { Icon } from '@/components/ui/icon';
import { Logo } from '@/components/ui/logo';
import { Text } from '@/components/ui/text';
import { listActiveShops } from '@/db/shops';
import { NAV_ITEMS } from '@/navigation/nav-items';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * The side menu. For the owner it is also the one place the working shop is
 * chosen — Sales and Inventory follow it, and it stays until changed here.
 */
export function SideDrawer({
  open,
  user,
  activeShopId,
  dataVersion,
  onChooseShop,
  onClose,
  onNavigate,
  onSignOut,
}: {
  open: boolean;
  user: User;
  activeShopId: string | null;
  dataVersion: number;
  onChooseShop: (shopId: string) => void;
  onClose: () => void;
  onNavigate: (route: string) => void;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const isOwner = user.role === 'owner';
  const [shops, setShops] = useState<Shop[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    let live = true;
    void listActiveShops(db).then((rows) => live && setShops(rows));
    return () => {
      live = false;
    };
  }, [db, isOwner, dataVersion, open]);

  const shopName = isOwner ? (shops.find((s) => s.id === activeShopId)?.name ?? '—') : (user.shop?.name ?? '—');

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
          {isOwner ? (
            <View style={styles.shopBox}>
              <Pressable style={styles.shopRow} onPress={() => setPicking((p) => !p)} accessibilityRole="button">
                <Icon name="storefront" color={colors.regalPlum} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopLabel} color={colors.onSurfaceVariant}>
                    WORKING SHOP
                  </Text>
                  <Text style={styles.shopName} color={colors.regalPlum}>
                    {shopName}
                  </Text>
                </View>
                <Text style={styles.change} color={colors.monarchGold}>
                  {picking ? 'Done' : 'Change'}
                </Text>
              </Pressable>
              {picking ? (
                <View style={{ gap: 4, marginTop: 8 }}>
                  {shops.map((s) => (
                    <Pressable
                      key={s.id}
                      style={[styles.shopOption, s.id === activeShopId && styles.shopOptionOn]}
                      onPress={() => {
                        setPicking(false);
                        onChooseShop(s.id);
                      }}>
                      <Text style={styles.shopOptionText} color={colors.regalPlum}>
                        {s.name}
                      </Text>
                      {s.id === activeShopId ? <Icon name="check" size={18} color={colors.successEmerald} /> : null}
                    </Pressable>
                  ))}
                  {!shops.length ? (
                    <Text style={styles.shopOptionText} color={colors.onSurfaceVariant}>
                      Sync to load shops.
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
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
          </ScrollView>
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
  shopBox: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lavenderMist },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  shopLabel: { fontFamily: fonts.sansSemi, fontSize: 9, letterSpacing: 1 },
  shopName: { fontFamily: fonts.sansSemi, fontSize: 14 },
  change: { fontFamily: fonts.sansSemi, fontSize: 12 },
  shopOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  shopOptionOn: { backgroundColor: 'rgba(243,232,245,0.6)' },
  shopOptionText: { fontFamily: fonts.sans, fontSize: 14 },
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
