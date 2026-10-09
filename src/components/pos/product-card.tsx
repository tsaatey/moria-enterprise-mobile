import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { type PosProduct, stockFlags } from '@/db/catalog';
import { formatGhs } from '@/lib/money';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * `renderPos()` product card. The prototype's "Premium" badge has no field
 * behind it in the API, so it is not shown.
 */
export const ProductCard = memo(function ProductCard({
  product,
  inCart,
  onAdd,
}: {
  product: PosProduct;
  inCart: boolean;
  onAdd: (p: PosProduct) => void;
}) {
  const { lowStock, oversold } = stockFlags(product);
  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {product.coverImageUrl ? (
          <Image source={product.coverImageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="disk" />
        ) : (
          <View style={styles.noImage}>
            <Icon name="image" size={32} color={colors.outlineVariant} />
          </View>
        )}
        {oversold ? (
          <Text style={[styles.badge, { backgroundColor: colors.errorCrimson }]} color={colors.white}>
            OVERSOLD
          </Text>
        ) : lowStock ? (
          <Text style={[styles.badge, { backgroundColor: colors.warningAmber }]} color={colors.white}>
            LOW
          </Text>
        ) : null}
      </View>
      <Text style={styles.name} color={colors.regalPlum} numberOfLines={1}>
        {product.name}
      </Text>
      <View style={styles.footer}>
        <View>
          <Text style={styles.currency} color={colors.onSurfaceVariant}>
            GHS
          </Text>
          <Text style={styles.price} color={colors.regalPlum}>
            {formatGhs(product.retailPrice)}
          </Text>
        </View>
        <Pressable
          onPress={() => onAdd(product)}
          accessibilityLabel={`Add ${product.name}`}
          style={({ pressed }) => [
            styles.add,
            { backgroundColor: inCart ? colors.monarchGold : colors.regalPlum, transform: [{ scale: pressed ? 0.9 : 1 }] },
          ]}>
          <Icon name={inCart ? 'check' : 'add'} size={18} color={inCart ? colors.regalPlum : colors.white} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
  },
  imageWrap: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.lavenderMist,
    marginBottom: 8,
  },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    fontFamily: fonts.sansBold,
    fontSize: 9,
  },
  name: { fontFamily: fonts.sansSemi, fontSize: 14, marginBottom: 4 },
  footer: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  currency: { fontFamily: fonts.sansSemi, fontSize: 9, textTransform: 'uppercase' },
  price: { fontFamily: fonts.sansBold, fontSize: 18, lineHeight: 20 },
  add: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
