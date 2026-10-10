import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type { Shop } from '@/api/types';
import { useSession } from '@/auth/session-store';
import { PaymentSheet } from '@/components/pos/payment-sheet';
import { ProductCard } from '@/components/pos/product-card';
import { ShopChips } from '@/components/shop-chips';
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
import { useSyncStore } from '@/sync/sync-store';
import { colors, fonts, radius } from '@/theme/tokens';

const METHOD_LABEL = { cash: 'cash', momo: 'MoMo', credit: 'credit' } as const;

/**
 * `renderPos()`: search, category chips, product grid and the "Current Order"
 * bar. Reads SQLite only, so it works offline.
 *
 * The owner belongs to no shop, and prices and stock are per shop, so the
 * owner picks the selling shop first (the web console does the same). A
 * salesperson always sells from their own shop.
 */
export default function PosScreen() {
  const db = useSQLiteContext();
  const user = useSession((s) => s.user)!;
  const { dataVersion, requestSync } = useSyncStore();
  const pullToSync = usePullToSync();
  const { shopId, lines, setShop, add, refreshProducts } = useCart();

  const [shops, setShops] = useState<Shop[]>([]);
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  const isOwner = user.role === 'owner';

  useFocusEffect(useCallback(() => setFocusTick((t) => t + 1), []));

  // The selling shop.
  useEffect(() => {
    if (!isOwner) return setShop(user.shopId);
    void listActiveShops(db).then((rows) => {
      setShops(rows);
      const current = useCart.getState().shopId;
      if (!current || !rows.some((s) => s.id === current)) setShop(rows[0]?.id ?? null);
    });
  }, [db, isOwner, user.shopId, setShop, dataVersion]);

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
      {isOwner ? (
        <View style={{ marginBottom: 12 }}>
          <ShopChips
            label="Selling at"
            shops={shops}
            selected={shopId}
            onSelect={(id) => {
              if (id !== shopId && lines.length) showToast('Order cleared — prices are per shop');
              setShop(id);
            }}
          />
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
