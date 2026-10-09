import { useState } from 'react';
import { Pressable } from 'react-native';

import { useSession } from '@/auth/session-store';
import { PIN_LENGTH } from '@/components/pin-pad';
import { pinFooterText, PinScreen } from '@/components/pin-screen';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';

/** Prototype: `screen-pin`. Unlocks offline against the local argon2id hash. */
export default function PinUnlockScreen() {
  const { unlock, logout } = useSession();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Enter PIN to unlock');

  const onChange = async (next: string) => {
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    setBusy(true);
    const { ok, attemptsLeft } = await unlock(next);
    setBusy(false);
    if (!ok) {
      setPin('');
      setMessage(`!Incorrect PIN · ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left`);
    }
  };

  return (
    <PinScreen
      title="Welcome Back"
      subtitle={busy ? 'Checking…' : message}
      value={pin}
      onChange={onChange}
      busy={busy}
      footer={
        <Pressable onPress={() => void logout()} hitSlop={8}>
          <Text style={pinFooterText} color={colors.onSurfaceVariant}>
            Use Password Instead
          </Text>
        </Pressable>
      }
    />
  );
}
