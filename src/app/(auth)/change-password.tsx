import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session-store';
import { AuthBackdrop, authCard } from '@/components/auth-backdrop';
import { Field } from '@/components/ui/field';
import { GoldButton } from '@/components/ui/gold-button';
import { Logo } from '@/components/ui/logo';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { colors, fonts } from '@/theme/tokens';

/**
 * Not in the prototype. The API holds an account whose password someone else
 * set (`mustChangePassword`) until `POST /auth/password` succeeds; this
 * reuses the login card, as the web console does.
 */
export default function ChangePasswordScreen() {
  const { changePassword, logout, user } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (next.length < 8) return setError('New password must be at least 8 characters.');
    if (next !== confirm) return setError('New passwords do not match.');
    if (next === current) return setError('New password must differ from the current one.');
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthBackdrop>
      <View style={authCard}>
        <View style={{ marginBottom: 24 }}>
          <Logo height={48} />
        </View>
        <Text style={styles.title} color={colors.regalPlum}>
          Set a New Password
        </Text>
        <Text style={styles.subtitle} color={colors.onSurfaceVariant}>
          {user?.name ? `${user.name}, your` : 'Your'} password was set by someone else. Choose your own to continue.
        </Text>
        <Field label="Current Password" icon="lock" secure value={current} onChangeText={setCurrent} autoComplete="current-password" />
        <Field label="New Password" icon="lock" secure value={next} onChangeText={setNext} autoComplete="new-password" />
        <Field label="Confirm New Password" icon="lock" secure value={confirm} onChangeText={setConfirm} autoComplete="new-password" onSubmitEditing={submit} />
        {error ? (
          <Text color={colors.error} style={{ marginBottom: 12 }}>
            {error}
          </Text>
        ) : null}
        <GoldButton label="Update Password" icon="arrow-forward" onPress={submit} loading={busy} />
        <Pressable onPress={() => void logout()} style={{ marginTop: 16, alignSelf: 'center' }} hitSlop={8}>
          <Text style={styles.signOut} color={colors.onSurfaceVariant}>
            Sign Out
          </Text>
        </Pressable>
      </View>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  signOut: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
});
