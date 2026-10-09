import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { create } from 'zustand';

import { colors, fonts } from '@/theme/tokens';

const useToastStore = create<{ message: string | null; key: number; overlays: number }>()(() => ({
  message: null,
  key: 0,
  overlays: 0,
}));

/**
 * A Modal covers the app's host, so each modal sheet mounts its own host and
 * registers itself here; only the topmost host shows the toast.
 */
export function useToastOverlay(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    useToastStore.setState((s) => ({ overlays: s.overlays + 1 }));
    return () => useToastStore.setState((s) => ({ overlays: s.overlays - 1 }));
  }, [open]);
}

/** The prototype's pill toast, bottom centre. */
export function showToast(message: string): void {
  useToastStore.setState((s) => ({ message, key: s.key + 1 }));
}

export function ToastHost({ bottom = 96, overlay = false }: { bottom?: number; overlay?: boolean }) {
  const { message, key, overlays } = useToastStore();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!message) return;
    progress.value = 0;
    progress.value = withSequence(withTiming(1, { duration: 300 }), withDelay(1800, withTiming(0, { duration: 300 })));
  }, [key, message, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 20 }],
  }));

  if (!message || (!overlay && overlays > 0)) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { bottom }, style]}>
      <Animated.Text style={styles.text} numberOfLines={1}>
        {message}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.regalPlum,
    zIndex: 60,
    maxWidth: '90%',
    elevation: 8,
  },
  text: { color: colors.silkWhite, fontFamily: fonts.sansSemi, fontSize: 14 },
});
