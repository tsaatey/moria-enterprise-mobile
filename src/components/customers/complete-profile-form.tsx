import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/ui/field';
import { GoldButton } from '@/components/ui/gold-button';
import { Text } from '@/components/ui/text';
import { completeCustomer, type LocalCustomer } from '@/db/customers';
import { colors } from '@/theme/tokens';

/**
 * Fill in a customer's missing name and address so they can buy on credit.
 * Works offline: it fills blanks only, the same rule the server applies when
 * the customer is pushed, so nothing someone else entered is overwritten.
 */
export function CompleteProfileForm({ customer, onSaved }: { customer: LocalCustomer; onSaved: (c: LocalCustomer) => void }) {
  const db = useSQLiteContext();
  const [name, setName] = useState(customer.name ?? '');
  const [address, setAddress] = useState(customer.address ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const hasName = !!customer.name?.trim();
  const hasAddress = !!customer.address?.trim();

  const save = async () => {
    const next: Record<string, string> = {};
    if (!hasName && name.trim().length < 2) next.name = 'Required for credit (at least 2 characters)';
    if (!hasAddress && !address.trim()) next.address = 'Required for credit';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const updated = await completeCustomer(db, customer.id, { name, address });
      if (updated) onSaved(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ marginBottom: 16, letterSpacing: 0 }}>
        {customer.phone} · Name and address are needed for credit sales.
      </Text>
      <Field label="Full Name *" value={name} onChangeText={setName} editable={!hasName} autoCapitalize="words" error={errors.name} />
      <Field label="Address *" value={address} onChangeText={setAddress} editable={!hasAddress} error={errors.address} />
      <GoldButton label="Save Customer" onPress={save} loading={busy} />
    </View>
  );
}
