import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme/tokens';

import { Icon } from './icon';
import { Text } from './text';
import { ToastHost, useToastOverlay } from './toast';

/** The prototype's bottom drawer: handle, eyebrow + display title, close button, scrolling body. */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  height = '88%',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  height?: `${number}%`;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  useToastOverlay(open);
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheet, { height }]}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {eyebrow ? (
              <Text variant="eyebrow" color={colors.onSurfaceVariant}>
                {eyebrow}
              </Text>
            ) : null}
            <Text style={styles.title} color={colors.regalPlum}>
              {title}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close">
            <Icon name="close" />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 24 }}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      <ToastHost overlay bottom={insets.bottom + 96} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(45,10,49,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.silkWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleRow: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 48, height: 6, borderRadius: 3, backgroundColor: 'rgba(208,195,204,0.4)' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lavenderMist,
  },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lavenderMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
