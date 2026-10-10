import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useSession } from '@/auth/session-store';
import { Field } from '@/components/ui/field';
import { GoldButton } from '@/components/ui/gold-button';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { listPosProducts, type PosProduct } from '@/db/catalog';
import { recordRestock } from '@/db/stock';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * The prototype's "Restock Inventory" form: Product, Quantity *, Reason,
 * Confirm Restock. The prototype's <select> becomes a searchable list, since
 * a catalog is too long to scroll through. Restocks the shop the screen is
 * showing; saved offline and pushed on the next sync.
 */
export function RestockSheet({
  open,
  shopId,
  shopName,
  initialProductId,
  onClose,
  onDone,
}: {
  open: boolean;
  shopId: string;
  shopName: string | null;
  initialProductId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const db = useSQLiteContext();
  const userId = useSession((s) => s.user?.id);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void listPosProducts(db, shopId).then((rows) => {
      if (!live) return;
      setProducts(rows);
      setProductId(initialProductId);
      setPicking(!initialProductId);
      setSearch('');
      setQty('');
      setReason('');
      setError(null);
    });
    return () => {
      live = false;
    };
  }, [open, db, shopId, initialProductId]);

  const selected = products.find((p) => p.id === productId) ?? null;
  const q = search.trim().toLowerCase();
  const matches = products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));

  const confirm = async () => {
    const n = Number(qty);
    if (!selected) return setError('Choose a product');
    if (!/^\d+$/.test(qty.trim()) || n < 1) return setError('Enter a valid quantity');
    if (!userId) return;
    setBusy(true);
    try {
      await recordRestock(db, { shopId, productId: selected.id, quantity: n, reason, userId });
      showToast(`Restocked ${n} units of ${selected.name}`);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Restock Inventory" height="85%">
      {shopName ? (
        <Text variant="bodyMd" color={colors.onSurfaceVariant} style={{ marginTop: -8 }}>
          {shopName}
        </Text>
      ) : null}
      <View>
        <Text style={styles.label} color={colors.onSurfaceVariant}>
          Product
        </Text>
        {selected && !picking ? (
          <Pressable style={styles.selected} onPress={() => setPicking(true)} accessibilityRole="button">
            <Text style={styles.name} color={colors.regalPlum} numberOfLines={1}>
              {selected.name}
            </Text>
            <Text style={styles.units} color={colors.onSurfaceVariant}>
              ({selected.quantity ?? 0} units)
            </Text>
            <Icon name="expand-more" color={colors.onSurfaceVariant} />
          </Pressable>
        ) : (
          <>
            <View style={styles.search}>
              <Icon name="search" size={18} color={colors.onSurfaceVariant} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search product or barcode…"
                placeholderTextColor={colors.outline}
                style={styles.searchInput}
                autoCorrect={false}
              />
            </View>
            <View style={{ gap: 6 }}>
              {matches.slice(0, 8).map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.option, p.id === productId && styles.optionOn]}
                  onPress={() => {
                    setProductId(p.id);
                    setPicking(false);
                  }}>
                  <Text style={styles.name} color={colors.regalPlum} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.units} color={colors.onSurfaceVariant}>
                    ({p.quantity ?? 0} units)
                  </Text>
                </Pressable>
              ))}
              {!matches.length ? (
                <Text variant="bodyMd" color={colors.onSurfaceVariant}>
                  No products match.
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
      <View>
        <Field label="Quantity *" value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="Units to add" />
        <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Supplier delivery" />
        {error ? (
          <Text color={colors.error} style={{ marginBottom: 12 }}>
            {error}
          </Text>
        ) : null}
        <GoldButton label="Confirm Restock" onPress={confirm} loading={busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(243,232,245,0.5)',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  name: { fontFamily: fonts.sansSemi, fontSize: 14, flexShrink: 1 },
  units: { fontFamily: fonts.sans, fontSize: 12, flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(243,232,245,0.5)',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.regalPlum, padding: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
    borderRadius: radius.lg,
  },
  optionOn: { borderColor: colors.monarchGold },
});
