import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPad } from '@/components/pin-pad';
import { Logo } from '@/components/ui/logo';
import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

/** Layout of the prototype's `screen-pin`, shared by unlock and set-PIN. */
export function PinScreen({
  title,
  subtitle,
  value,
  onChange,
  busy,
  footer,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: string) => void;
  busy?: boolean;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40 }]}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Logo height={40} />
        <Text style={styles.title} color={colors.regalPlum}>
          {title}
        </Text>
        <Text variant="bodyMd" color={subtitle.startsWith('!') ? colors.error : colors.onSurfaceVariant}>
          {subtitle.replace(/^!/, '')}
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <PinPad value={value} onChange={onChange} disabled={busy} />
      </View>
      <View style={{ alignItems: 'center' }}>{footer}</View>
    </View>
  );
}

export const pinFooterText = { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' } as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.silkWhite, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, marginTop: 16 },
});
