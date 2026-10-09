import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** The prototype's `gold-shimmer` primary action (static gradient, no animation yet). */
export function GoldButton({
  label,
  onPress,
  icon,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: disabled ? 0.6 : 1 }]}>
      <LinearGradient
        colors={[colors.monarchGold, colors.monarchGoldLight, colors.monarchGold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}>
        {loading ? (
          <ActivityIndicator color={colors.regalPlum} />
        ) : (
          <View style={styles.row}>
            <Text style={styles.label} color={colors.regalPlum}>
              {label}
            </Text>
            {icon ? <Icon name={icon} size={18} /> : null}
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.sansBold, fontSize: 16 },
});
