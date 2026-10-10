import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useSession } from '@/auth/session-store';
import { PaymentSheet } from '@/components/pos/payment-sheet';
import { ProductCard } from '@/components/pos/product-card';
import { Chip } from '@/components/ui/chip';
import { usePullToSync } from '@/components/ui/pull-to-sync';
import { Icon } from '@/components/ui/icon';
import { SuccessModal } from '@/components/ui/success-modal';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { listPosCategories, listPosProducts, type PosCategory, type PosProduct } from '@/db/catalog';
import { listActiveShops } from '@/db/shops';
import { formatGhs } from '@/lib/money';
import { priceCart, useCart } from '@/pos/cart-store';
import { useActiveShopId } from '@/shop/active-shop';
import { useSyncStore } from '@/sync/sync-store';
import { colors, fonts, radius } from '@/theme/tokens';

const METHOD_LABEL = { cash: 'cash', momo: 'MoMo', credit: 'credit' } as const;

/**
 * `renderPos()`: search, category chips, product grid and the "Current Order"
 * bar. Reads SQLite only, so it works offline.
 *
 * Sells from the working shop: the owner's choice in the side menu (prices
 * and stock are per shop), or a salesperson's own shop.
 */
export default function PosScreen() {
  const db = useSQLiteContext();
  const user = useSession((s) => s.user)!;
  const { dataVersion, requestSync } = useSyncStore();
  const pullToSync = usePullToSync();
  const shopId = useActiveShopId();
  const { lines, add, refreshProducts } = useCart();

  const [shopName, setShopName] = useState<string | null>(null);
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  const isOwner = user.role === 'owner';

  useFocusEffect(useCallback(() => setFocusTick((t) => t + 1), []));

  // The selling shop is the owner's working shop, chosen in the side menu
  // (src/shop/active-shop.ts); a salesperson's is their own.
  useEffect(() => {
    if (!isOwner || !shopId) return;
    let live = true;
    void listActiveShops(db).then((rows) => live && setShopName(rows.find((r) => r.id === shopId)?.name ?? null));
    return () => {
      live = false;
    };
  }, [db, isOwner, shopId, dataVersion]);

  useEffect(() => {
    void listPosCategories(db).then(setCategories);
  }, [db, dataVersion]);

  useEffect(() => {
    if (!shopId) return;
    let live = true;
    void listPosProducts(db, shopId, { search, categoryId }).then((rows) => {
      if (!live) return;
      setProducts(rows);
      refreshProducts(rows);
    });
    return () => {
      live = false;
    };
  }, [db, shopId, search, categoryId, dataVersion, focusTick, refreshProducts]);

  const cart = priceCart(lines);
  const inCart = new Set(lines.map((l) => l.product.id));

  const onAdd = useCallback(
    (p: PosProduct) => {
      add(p);
      showToast(`Added ${p.name}`);
    },
    [add],
  );

  const header = (
    <View>
      {isOwner && shopName ? (
        <View style={styles.context}>
          <Icon name="storefront" size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.contextText} color={colors.onSurfaceVariant}>
            Selling at <Text style={styles.contextShop} color={colors.regalPlum}>{shopName}</Text>
          </Text>
        </View>
      ) : null}
      <View style={styles.search}>
        <Icon name="search" color={colors.onSurfaceVariant} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search collection or barcode…"
          placeholderTextColor={colors.outline}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" selected={categoryId === null} onPress={() => setCategoryId(null)} />
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={shopId ? products : []}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <ProductCard product={item} inCart={inCart.has(item.id)} onAdd={onAdd} />}
        ListEmptyComponent={
          <Text color={colors.onSurfaceVariant} style={{ textAlign: 'center', paddingVertical: 32 }}>
            {search || categoryId ? 'No products match your search' : 'No products yet — pull down to sync.'}
          </Text>
        }
        refreshControl={pullToSync}
      />

      {lines.length ? (
        <Pressable
          onPress={() => setPayOpen(true)}
          style={({ pressed }) => [styles.cartBar, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
          accessibilityLabel="Open current order">
          <View style={styles.cartCount}>
            <Text style={styles.cartCountText} color={colors.regalPlum}>
              {cart.count}
            </Text>
          </View>
          <Text style={styles.cartLabel} color={colors.white}>
            Current Order
          </Text>
          <Text style={styles.cartTotal} color={colors.white}>
            GHS {formatGhs(cart.total)}
          </Text>
        </Pressable>
      ) : null}

      <PaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onComplete={({ total, method }) => {
          setPayOpen(false);
          setSuccess(`GHS ${formatGhs(total)} recorded via ${METHOD_LABEL[method]}`);
          setFocusTick((t) => t + 1);
          requestSync?.();
        }}
      />
      <SuccessModal open={success !== null} title="Sale Complete" message={success ?? ''} onContinue={() => setSuccess(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: colors.lavenderMist,
    borderRadius: radius.lg,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.regalPlum, padding: 0 },
  chips: { gap: 8, paddingBottom: 12 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  contextText: { fontFamily: fonts.sans, fontSize: 13 },
  contextShop: { fontFamily: fonts.sansSemi, fontSize: 13 },
  cartBar: {
    marginHorizontal: 12,
    marginBottom: 4,
    backgroundColor: colors.regalPlum,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartCount: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.monarchGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: { fontFamily: fonts.sansBold, fontSize: 14 },
  cartLabel: { fontFamily: fonts.sansSemi, fontSize: 16 },
  cartTotal: { fontFamily: fonts.sansBold, fontSize: 16 },
});
