import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

export const PIN_LENGTH = 4;

/** Dots plus the 3×4 keypad from the prototype's `screen-pin`. */
export function PinPad({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === 'del') onChange(value.slice(0, -1));
    else if (value.length < PIN_LENGTH) onChange(value + k);
  };

  return (
    <View style={{ alignItems: 'center', gap: 40 }}>
      <View style={styles.dots} accessibilityLabel={`${value.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              onPress={() => press(k)}
              accessibilityLabel={k === 'del' ? 'Delete' : k}
              style={({ pressed }) => [styles.key, pressed && { backgroundColor: 'rgba(243,232,245,0.5)', transform: [{ scale: 0.9 }] }]}>
              {k === 'del' ? <Icon name="backspace" size={24} /> : <Text style={styles.digit} color={colors.regalPlum}>{k}</Text>}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 20 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.outlineVariant },
  dotActive: { backgroundColor: colors.regalPlum, borderColor: colors.regalPlum },
  pad: { width: 3 * 64 + 2 * 32, flexDirection: 'row', flexWrap: 'wrap', columnGap: 32, rowGap: 20 },
  key: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.sansSemi, fontSize: 24 },
});
