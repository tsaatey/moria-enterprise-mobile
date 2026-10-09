import { Text as RNText, type TextProps } from 'react-native';

import { colors, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;

export function Text({
  variant = 'bodyMd',
  color = colors.onSurface,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  return <RNText {...rest} style={[typeScale[variant], { color }, style]} />;
}
