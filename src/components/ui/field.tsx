import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** Labelled input on lavender, gold underline on focus — the login card's field style. */
export function Field({
  label,
  icon,
  error,
  secure,
  right,
  ...input
}: TextInputProps & { label: string; icon?: IconName; error?: string; secure?: boolean; right?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label} color={colors.onSurfaceVariant}>
          {label}
        </Text>
        {right}
      </View>
      <View style={[styles.box, { borderBottomColor: focused ? colors.monarchGold : colors.lavenderMist }]}>
        {icon ? <Icon name={icon} size={20} color={colors.outline} /> : null}
        <TextInput
          {...input}
          secureTextEntry={hidden}
          placeholderTextColor={colors.outline}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={styles.input}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel="Toggle password visibility">
            <Icon name={hidden ? 'visibility' : 'visibility-off'} size={20} color={colors.outline} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="labelMd" color={colors.error} style={{ marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(243,232,245,0.5)',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.regalPlum, padding: 0 },
});
