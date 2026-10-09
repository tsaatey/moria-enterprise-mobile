import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

/** The login screen's `luxury-gradient` with the blurred gold glow, top left. */
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={[colors.regalPlumLight, colors.regalPlum]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
      <View style={styles.glow} pointerEvents="none" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

export const authCard = {
  backgroundColor: colors.white,
  borderRadius: 16,
  padding: 32,
  borderWidth: 1,
  borderColor: colors.lavenderMist,
  shadowColor: '#000',
  shadowOpacity: 0.25,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 12,
} as const;

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 },
  glow: {
    position: 'absolute',
    top: -96,
    left: -96,
    width: 288,
    height: 288,
    borderRadius: 144,
    backgroundColor: colors.monarchGold,
    opacity: 0.2,
  },
});
