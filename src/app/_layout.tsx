import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useSession } from '@/auth/session-store';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { isAllowedPath, sessionRoute } from '@/navigation/session-route';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });
  const status = useSession((s) => s.status);
  const bootstrap = useSession((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const ready = fontsLoaded && status !== 'booting';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <StatusBar style="dark" />
      <SessionGuard />
      {/*
        Every screen stays registered; <SessionGuard /> decides which one the
        app may be on. Stack.Protected guards were tried here, but in this
        Expo Router version switching them on root-level screens was never
        applied to the navigator: after a successful sign-in the status became
        `setPin`, Set PIN was never registered, the login screen stayed up and
        every redirect to it was dropped.
      */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/pin" />
        <Stack.Screen name="(auth)/set-pin" />
        <Stack.Screen name="(auth)/change-password" />
      </Stack>
    </SQLiteProvider>
  );
}

/**
 * Keeps the app on a screen its session status allows, and so does what the
 * guards were for: sign-in, PIN set or unlocked, password changed, lock and
 * sign-out each move it, and an app screen can never show while signed out.
 *
 * It compares where the app *is* with where the status allows, not the
 * previous status with the new one, so it stays right however often it
 * re-renders. Nothing navigates until the root navigator exists.
 */
function SessionGuard() {
  const status = useSession((s) => s.status);
  const role = useSession((s) => s.user?.role);
  const router = useRouter();
  const pathname = usePathname();
  const navigatorReady = !!useRootNavigationState()?.key;

  const target = sessionRoute(status, role);
  const misplaced = target !== null && !isAllowedPath(pathname, status, role);

  useEffect(() => {
    if (navigatorReady && misplaced && target !== null) router.replace(target);
  }, [navigatorReady, misplaced, target, router]);

  return null;
}
