import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

/** The login screen's `luxury-gradient` with the blurred gold glow, top left. */
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={[colors.regalPlumLight, colors.regalPlum]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
      {/* The prototype's blur-[100px] gold glow; RN has no CSS blur, so fake it with fading rings. */}
      {GLOW_RINGS.map((r) => (
        <View
          key={r}
          pointerEvents="none"
          style={[styles.glow, { width: r * 2, height: r * 2, borderRadius: r, top: 48 - r, left: 48 - r }]}
        />
      ))}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// Many thin, faint rings so the falloff reads as a blur rather than bands.
const GLOW_RINGS = Array.from({ length: 24 }, (_, i) => 220 - i * 8);

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
  glow: { position: 'absolute', backgroundColor: colors.monarchGold, opacity: 0.014 },
});
