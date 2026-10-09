import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session-store';
import { AuthBackdrop, authCard } from '@/components/auth-backdrop';
import { Field } from '@/components/ui/field';
import { GoldButton } from '@/components/ui/gold-button';
import { Icon } from '@/components/ui/icon';
import { Logo } from '@/components/ui/logo';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/error-message';
import { colors, fonts } from '@/theme/tokens';

/** Prototype: `screen-login`. The demo-role buttons are prototype-only and omitted. */
export default function LoginScreen() {
  const login = useSession((s) => s.login);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!phone.trim() || !password) {
      setError('Enter your phone number and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(phone.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthBackdrop>
      <View style={authCard}>
        <View style={{ marginBottom: 32 }}>
          <Logo height={56} />
        </View>
        <Text style={styles.title} color={colors.regalPlum}>
          Welcome Back
        </Text>
        <Text style={styles.subtitle} color={colors.onSurfaceVariant}>
          Access your shop management portal
        </Text>

        <Field
          label="Phone Number"
          icon="phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="0244000000"
        />
        <Field
          label="Password"
          icon="lock"
          secure
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          returnKeyType="go"
          right={
            <Pressable
              hitSlop={8}
              onPress={() => Alert.alert('Forgot password?', 'Ask the shop owner to reset your password.')}>
              <Text style={styles.forgot} color={colors.monarchGold}>
                Forgot?
              </Text>
            </Pressable>
          }
        />

        {error ? (
          <Text color={colors.error} style={{ marginBottom: 12 }}>
            {error}
          </Text>
        ) : null}

        <GoldButton label="Login" icon="arrow-forward" onPress={submit} loading={busy} />

        <View style={styles.secure}>
          <Icon name="verified-user" size={14} color={colors.successEmerald} />
          <Text style={styles.secureText} color={colors.onSurfaceVariant}>
            SECURE ENTERPRISE PORTAL
          </Text>
        </View>
      </View>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  forgot: { fontFamily: fonts.sansSemi, fontSize: 12 },
  secure: { marginTop: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  secureText: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2 },
});
