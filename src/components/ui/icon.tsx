import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme/tokens';

/**
 * The prototype uses Material Symbols Outlined; MaterialIcons carries the same
 * glyph names with hyphens (`point_of_sale` → `point-of-sale`).
 */
export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export function Icon({ name, size = 22, color = colors.regalPlum }: { name: IconName; size?: number; color?: ColorValue }) {
  return <MaterialIcons name={name} size={size} color={color} />;
}
