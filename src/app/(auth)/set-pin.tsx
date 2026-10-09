import { useState } from 'react';

import { useSession } from '@/auth/session-store';
import { PIN_LENGTH } from '@/components/pin-pad';
import { PinScreen } from '@/components/pin-screen';

/**
 * Not in the prototype: § PIN Unlock has the user set a PIN after the first
 * full login. Reuses the unlock screen's layout — enter, then confirm.
 */
export default function SetPinScreen() {
  const setPin = useSession((s) => s.setPin);
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const onChange = async (next: string) => {
    setValue(next);
    if (next.length < PIN_LENGTH) return;
    if (first === null) {
      setFirst(next);
      setValue('');
      setMismatch(false);
      return;
    }
    if (next !== first) {
      setFirst(null);
      setValue('');
      setMismatch(true);
      return;
    }
    setBusy(true);
    await setPin(next);
  };

  const subtitle = busy
    ? 'Securing…'
    : mismatch
      ? '!PINs did not match · start again'
      : first === null
        ? 'Choose a PIN for quick unlock'
        : 'Enter it again to confirm';

  return <PinScreen title={first === null ? 'Create a PIN' : 'Confirm PIN'} subtitle={subtitle} value={value} onChange={onChange} busy={busy} />;
}
