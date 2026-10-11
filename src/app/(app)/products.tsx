import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ProductSheet } from '@/components/products/product-sheet';
import { Icon } from '@/components/ui/icon';
import { usePullToSync } from '@/components/ui/pull-to-sync';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { type CatalogProduct, listCatalogProducts } from '@/db/catalog';
import { listActiveShops } from '@/db/shops';
import { formatGhs } from '@/lib/money';
import { useActiveShopId } from '@/shop/active-shop';
import { useSyncStore } from '@/sync/sync-store';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * `renderProducts()` — Catalog · Products. Owner only (route guarded). The
 * list reads SQLite; adding or editing a product is online, and the change
 * reaches every device on its next pull.
 *
 * Additions: search, tap a product to edit it, deactivated products listed
 * last and marked, and stock shown across all shops.
 */
export default function ProductsScreen() {
  const db = useSQLiteContext();
  const { dataVersion, requestSync } = useSyncStore();
  const pullToSync = usePullToSync();
  const shopId = useActiveShopId();

  const [rows, setRows] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState('');
  const [shopName, setShopName] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ product: CatalogProduct | null } | null>(null);
  const [tick, setTick] = useState(0);

  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));

  useEffect(() => {
    let live = true;
    void listCatalogProducts(db, { search, shopId }).then((r) => live && setRows(r));
    void listActiveShops(db).then((s) => live && setShopName(s.find((x) => x.id === shopId)?.name ?? null));
    return () => {
      live = false;
    };
  }, [db, search, shopId, dataVersion, tick]);

  const activeCount = rows.filter((r) => r.isActive).length;

  const header = (
    <View style={{ gap: 16, marginBottom: 4 }}>
      <View style={styles.headRow}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="eyebrow" color={colors.onSurfaceVariant}>
            Catalog
          </Text>
          <Text style={styles.h2} color={colors.regalPlum}>
            Products
          </Text>
          <Text variant="bodyMd" color={colors.onSurfaceVariant}>
            {activeCount} SKUs{rows.length > activeCount ? ` · ${rows.length - activeCount} inactive` : ''}
          </Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setEditing({ product: null })}>
          <Icon name="add" size={14} color={colors.white} />
          <Text style={styles.addBtnText} color={colors.white}>
            Add Product
          </Text>
        </Pressable>
      </View>
      <Pressable style={styles.addCard} onPress={() => setEditing({ product: null })} accessibilityRole="button">
        <Icon name="add-a-photo" size={30} />
        <Text style={styles.addCardTitle} color={colors.regalPlum}>
          Add product with cover photo
        </Text>
        <Text style={styles.addCardHint} color={colors.onSurfaceVariant}>
          Name, category, price, barcode, image
        </Text>
      </Pressable>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.onSurfaceVariant} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or barcode…"
          placeholderTextColor={colors.outline}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 8 }}
        ListHeaderComponent={header}
        refreshControl={pullToSync}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable style={[styles.row, !item.isActive && { opacity: 0.6 }]} onPress={() => setEditing({ product: item })}>
            {item.coverImageUrl ? (
              <Image source={item.coverImageUrl} style={styles.thumb} contentFit="cover" cachePolicy="disk" />
            ) : (
              <View style={[styles.thumb, styles.noThumb]}>
                <Icon name="image" size={22} color={colors.outlineVariant} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.name} color={colors.regalPlum} numberOfLines={1}>
                  {item.name}
                </Text>
                {!item.isActive ? (
                  <Text style={styles.inactive} color={colors.onSurfaceVariant}>
                    INACTIVE
                  </Text>
                ) : null}
              </View>
              {item.barcode ? (
                <Text style={styles.barcode} color={colors.onSurfaceVariant}>
                  {item.barcode}
                </Text>
              ) : null}
              <Text style={styles.meta} color={colors.onSurfaceVariant}>
                {item.categoryName ?? '—'} · GHS {formatGhs(item.defaultPrice)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.qty} color={colors.regalPlum}>
                {item.totalQuantity}
              </Text>
              <Text style={styles.qtyLabel} color={colors.onSurfaceVariant}>
                IN STOCK
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text color={colors.onSurfaceVariant} style={{ textAlign: 'center', paddingVertical: 32 }}>
            {search ? 'No products match your search' : 'No products yet'}
          </Text>
        }
      />
      <ProductSheet
        open={editing !== null}
        product={editing?.product ?? null}
        shopId={shopId}
        shopName={shopName}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          setEditing(null);
          showToast(message);
          requestSync?.();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.regalPlum,
  },
  addBtnText: { fontFamily: fonts.sansBold, fontSize: 12 },
  addCard: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.monarchGold,
    backgroundColor: 'rgba(243,232,245,0.3)',
  },
  addCardTitle: { fontFamily: fonts.sansBold, fontSize: 14 },
  addCardHint: { fontFamily: fonts.sans, fontSize: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: colors.lavenderMist,
    borderRadius: radius.lg,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.regalPlum, padding: 0 },
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
  name: { fontFamily: fonts.sansSemi, fontSize: 14, flexShrink: 1 },
  inactive: { fontFamily: fonts.sansBold, fontSize: 8, letterSpacing: 0.5 },
  barcode: { fontFamily: 'monospace', fontSize: 10 },
  meta: { fontFamily: fonts.sans, fontSize: 12 },
  qty: { fontFamily: fonts.sansBold, fontSize: 14 },
  qtyLabel: { fontFamily: fonts.sansSemi, fontSize: 9 },
});
