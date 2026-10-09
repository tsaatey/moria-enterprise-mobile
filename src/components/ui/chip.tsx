import { Pressable, StyleSheet } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { Text } from './text';

/** Rounded filter pill: plum when selected, outlined white otherwise. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.on : styles.off]}>
      <Text style={styles.label} color={selected ? colors.white : colors.regalPlum}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  on: { backgroundColor: colors.regalPlum },
  off: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lavenderMist },
  label: { fontFamily: fonts.sansSemi, fontSize: 12 },
});
