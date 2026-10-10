import { ScrollView, View } from 'react-native';

import type { Shop } from '@/api/types';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

/** The owner's shop picker: an owner belongs to no shop, and stock and prices are per shop. */
export function ShopChips({
  label,
  shops,
  selected,
  onSelect,
}: {
  label: string;
  shops: Shop[];
  selected: string | null;
  onSelect: (shopId: string) => void;
}) {
  return (
    <View>
      <Text variant="eyebrow" color={colors.onSurfaceVariant} style={{ marginBottom: 8 }}>
        {label}
      </Text>
      {shops.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {shops.map((s) => (
            <Chip key={s.id} label={s.name} selected={s.id === selected} onPress={() => onSelect(s.id)} />
          ))}
        </ScrollView>
      ) : (
        <Text variant="bodyMd" color={colors.onSurfaceVariant}>
          No shops on this device yet — sync to load them.
        </Text>
      )}
    </View>
  );
}
