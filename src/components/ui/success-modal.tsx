import { Modal, StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { GoldButton } from './gold-button';
import { Icon } from './icon';
import { Text } from './text';

/** The prototype's `success-modal`. */
export function SuccessModal({
  open,
  title,
  message,
  onContinue,
}: {
  open: boolean;
  title: string;
  message: string;
  onContinue: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onContinue}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Icon name="check-circle" size={40} color={colors.successEmerald} />
          </View>
          <Text style={styles.title} color={colors.regalPlum}>
            {title}
          </Text>
          <Text variant="bodyMd" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginBottom: 24 }}>
            {message}
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <GoldButton label="Continue" onPress={onContinue} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(45,10,49,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 32, width: '100%', maxWidth: 320, alignItems: 'center' },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(27,94,32,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 28, marginBottom: 8 },
});
