import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { Shop } from '@/api/types';
import { useSession } from '@/auth/session-store';
import { RestockSheet } from '@/components/inventory/restock-sheet';
import { ShopChips } from '@/components/shop-chips';
import { Icon } from '@/components/ui/icon';
import { usePullToSync } from '@/components/ui/pull-to-sync';
import { Text } from '@/components/ui/text';
import { listInventory, type PosProduct, type StockFilter, stockFlags } from '@/db/catalog';
import { listActiveShops } from '@/db/shops';
import { formatGhs } from '@/lib/money';
import { useSyncStore } from '@/sync/sync-store';
import { colors, fonts, radius } from '@/theme/tokens';

const FILTERS: { id: StockFilter; label: string; color: string }[] = [
  { id: 'all', label: 'All', color: colors.regalPlum },
  { id: 'low', label: 'Low Stock', color: colors.warningAmber },
  { id: 'oversold', label: 'Oversold', color: colors.errorCrimson },
];

/**
 * `renderInventory()` — "Stock Levels". Reads SQLite, so it works offline.
 * The owner picks the shop (stock is per shop) and can restock it; a
 * salesperson sees their own shop, read-only, as § Authorization Matrix has it.
 */
export default function InventoryScreen() {
  const db = useSQLiteContext();
  const user = useSession((s) => s.user)!;
  const isOwner = user.role === 'owner';
  const { dataVersion, requestSync } = useSyncStore();
  const pullToSync = usePullToSync();

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState<string | null>(isOwner ? null : user.shopId);
  const [filter, setFilter] = useState<StockFilter>('all');
  const [rows, setRows] = useState<PosProduct[]>([]);
  const [tick, setTick] = useState(0);
  const [restock, setRestock] = useState<{ productId: string | null } | null>(null);

  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));

  useEffect(() => {
    if (!isOwner) return;
    void listActiveShops(db).then((list) => {
      setShops(list);
      setShopId((cur) => (cur && list.some((s) => s.id === cur) ? cur : (list[0]?.id ?? null)));
    });
  }, [db, isOwner, dataVersion]);

  useEffect(() => {
    if (!shopId) return;
    let live = true;
    void listInventory(db, shopId, { filter }).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [db, shopId, filter, dataVersion, tick]);

  const shopName = isOwner ? (shops.find((s) => s.id === shopId)?.name ?? null) : (user.shop?.name ?? null);

  const header = (
    <View style={{ gap: 16, marginBottom: 4 }}>
      <View style={styles.headRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.h2} color={colors.regalPlum}>
            Stock Levels
          </Text>
          <Text variant="bodyMd" color={colors.onSurfaceVariant}>
            {isOwner ? `All shops · ${shopName ?? '—'}` : 'Your shop'}
          </Text>
        </View>
        {isOwner ? (
          <View style={styles.actions}>
            <Pressable style={[styles.action, { backgroundColor: colors.monarchGold }]} onPress={() => setRestock({ productId: null })}>
              <Icon name="inventory" size={14} />
              <Text style={styles.actionText} color={colors.regalPlum}>
                Restock
              </Text>
            </Pressable>
            <Pressable style={[styles.action, { backgroundColor: colors.regalPlum }]} onPress={() => router.navigate('/products')}>
              <Icon name="add" size={14} color={colors.white} />
              <Text style={styles.actionText} color={colors.white}>
                Product
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {isOwner ? <ShopChips label="Shop" shops={shops} selected={shopId} onSelect={setShopId} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              accessibilityState={{ selected: on }}
              style={[styles.filter, on ? { backgroundColor: f.color } : styles.filterOff]}>
              <Text style={styles.filterText} color={on ? colors.white : f.color}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={shopId ? rows : []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
        ListHeaderComponent={header}
        refreshControl={pullToSync}
        renderItem={({ item }) => (
          <StockRow product={item} onPress={isOwner ? () => setRestock({ productId: item.id }) : undefined} />
        )}
        ListEmptyComponent={
          <Text color={colors.onSurfaceVariant} style={{ textAlign: 'center', paddingVertical: 32 }}>
            {filter === 'all' ? 'No products yet — pull down to sync.' : filter === 'low' ? 'Nothing is low.' : 'Nothing is oversold.'}
          </Text>
        }
      />
      {isOwner && shopId ? (
        <RestockSheet
          open={restock !== null}
          shopId={shopId}
          shopName={shopName}
          initialProductId={restock?.productId ?? null}
          onClose={() => setRestock(null)}
          onDone={() => {
            setRestock(null);
            setTick((t) => t + 1);
            requestSync?.();
          }}
        />
      ) : null}
    </View>
  );
}

function StockRow({ product: p, onPress }: { product: PosProduct; onPress?: () => void }) {
  const f = stockFlags(p);
  const qty = p.quantity ?? 0;
  const qtyColor = !f.stocked ? colors.outline : f.oversold ? colors.errorCrimson : f.lowStock ? colors.warningAmber : colors.regalPlum;
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress} accessibilityHint={onPress ? 'Restock this product' : undefined}>
      {p.coverImageUrl ? (
        <Image source={p.coverImageUrl} style={styles.thumb} contentFit="cover" cachePolicy="disk" />
      ) : (
        <View style={[styles.thumb, styles.noThumb]}>
          <Icon name="image" size={22} color={colors.outlineVariant} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} color={colors.regalPlum} numberOfLines={1}>
            {p.name}
          </Text>
          {f.lowStock ? <Text style={[styles.badge, { backgroundColor: colors.warningAmber }]} color={colors.white}>LOW</Text> : null}
          {f.oversold ? <Text style={[styles.badge, { backgroundColor: colors.errorCrimson }]} color={colors.white}>OVER</Text> : null}
        </View>
        {p.barcode ? (
          <Text style={styles.barcode} color={colors.onSurfaceVariant}>
            {p.barcode}
          </Text>
        ) : null}
        <Text style={styles.meta} color={colors.onSurfaceVariant}>
          GHS {formatGhs(p.retailPrice)} · {f.stocked ? `Reorder ${p.reorderLevel}` : 'Not stocked here'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.qty} color={qtyColor}>
          {qty}
        </Text>
        <Text style={styles.unitsLabel} color={colors.onSurfaceVariant}>
          UNITS
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 },
  h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg },
  actionText: { fontFamily: fonts.sansBold, fontSize: 12 },
  filter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  filterOff: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lavenderMist },
  filterText: { fontFamily: fonts.sansSemi, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.lavenderMist },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.sansSemi, fontSize: 14, flexShrink: 1 },
  badge: { fontFamily: fonts.sansBold, fontSize: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  barcode: { fontFamily: 'monospace', fontSize: 10 },
  meta: { fontFamily: fonts.sans, fontSize: 12 },
  qty: { fontFamily: fonts.sansBold, fontSize: 18 },
  unitsLabel: { fontFamily: fonts.sansSemi, fontSize: 9 },
});
