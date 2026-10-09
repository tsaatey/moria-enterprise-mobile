import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { useSession } from '@/auth/session-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { GoldButton } from '@/components/ui/gold-button';
import { Text } from '@/components/ui/text';
import {
  completeCustomer,
  createCustomer,
  findCustomerByPhone,
  isCreditEligible,
  type LocalCustomer,
} from '@/db/customers';
import { normalizePhone } from '@/lib/phone';
import { colors } from '@/theme/tokens';

/**
 * The prototype's "Add Customer" form (`renderForm` → addCustomer). Saved
 * locally and queued; works offline. With `requireCredit`, name and address
 * become required, since a credit sale needs a full-tier customer.
 *
 * A phone already on this device returns that customer instead of a duplicate
 * (the API refuses a duplicate phone, and sync would merge it anyway).
 */
export function CustomerForm({
  initialPhone = '',
  requireCredit = false,
  onSaved,
}: {
  initialPhone?: string;
  requireCredit?: boolean;
  onSaved: (customer: LocalCustomer, existing: boolean) => void;
}) {
  const db = useSQLiteContext();
  const userId = useSession((s) => s.user?.id);
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    // Stored in the server's canonical form so the duplicate check and sync merge line up.
    const p = normalizePhone(phone);
    const next: Record<string, string> = {};
    if (!p) next.phone = 'Must be a Ghana phone number, e.g. 0244000000 or +233244000000';
    if (name.trim() && name.trim().length < 2) next.name = 'At least 2 characters';
    if (requireCredit && !name.trim()) next.name = 'Required for credit';
    if (requireCredit && !address.trim()) next.address = 'Required for credit';
    setErrors(next);
    if (!p || Object.keys(next).length || !userId) return;

    setBusy(true);
    try {
      const existing = await findCustomerByPhone(db, p);
      if (existing) {
        const complete =
          requireCredit && !isCreditEligible(existing) ? await completeCustomer(db, existing.id, { name, address }) : existing;
        return onSaved(complete ?? existing, true);
      }
      onSaved(await createCustomer(db, { phone: p, name, address, smsOptIn, createdBy: userId }), false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ marginBottom: 16, letterSpacing: 0 }}>
        Phone is required. Name and address are needed for credit sales.
      </Text>
      <Field label="Phone *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+233 24 XXX XXXX" error={errors.phone} />
      <Field label={requireCredit ? 'Full Name *' : 'Full Name'} value={name} onChangeText={setName} placeholder="For credit tier" error={errors.name} autoCapitalize="words" />
      <Field label={requireCredit ? 'Address *' : 'Address'} value={address} onChangeText={setAddress} placeholder="Required for credit" error={errors.address} />
      <Checkbox label="SMS marketing opt-in" checked={smsOptIn} onChange={setSmsOptIn} />
      <GoldButton label="Save Customer" onPress={save} loading={busy} />
    </View>
  );
}
