import { Pressable, StyleSheet } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { Icon } from './icon';
import { Text } from './text';

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}>
      <Icon name={checked ? 'check-box' : 'check-box-outline-blank'} color={colors.regalPlum} />
      <Text style={styles.label} color={colors.regalPlum}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  label: { fontFamily: fonts.sansSemi, fontSize: 14 },
});
