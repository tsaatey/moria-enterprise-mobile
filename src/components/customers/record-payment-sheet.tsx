import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { PaymentMethod } from '@/api/types';
import { useSession } from '@/auth/session-store';
import { GoldButton } from '@/components/ui/gold-button';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import type { CustomerListRow } from '@/db/customers';
import { getOpenDebts, type OpenDebt, recordDebtPayment } from '@/db/debts';
import { formatGhs, money, sumMoney, toMoney } from '@/lib/money';
import { colors, fonts, radius } from '@/theme/tokens';

const QUICK = ['100', '200', '500'];

function dueLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * `renderDebt()` — "Record Payment". Debt is per credit sale (each falls due
 * on its own day, and the API takes an instalment against one sale), so when
 * a customer has more than one open sale the sheet asks which, overdue and
 * oldest first. "Full" settles the chosen sale.
 */
export function RecordPaymentSheet({
  customer,
  onClose,
  onRecorded,
}: {
  customer: CustomerListRow | null;
  onClose: () => void;
  onRecorded: (summary: { amount: string; method: PaymentMethod }) => void;
}) {
  const db = useSQLiteContext();
  const user = useSession((s) => s.user)!;
  const isOwner = user.role === 'owner';
  const [debts, setDebts] = useState<OpenDebt[]>([]);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [momoRef, setMomoRef] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!customer) return;
    let live = true;
    void getOpenDebts(db, { customerId: customer.id }).then((rows) => {
      if (!live) return;
      setDebts(rows);
      setSaleId(rows[0]?.saleId ?? null);
      setAmount('');
      setMethod('cash');
      setMomoRef('');
    });
    return () => {
      live = false;
    };
  }, [db, customer]);

  const selected = debts.find((d) => d.saleId === saleId) ?? null;
  const total = sumMoney(debts.map((d) => d.balance));

  const submit = async () => {
    if (!customer || !selected) return;
    const a = amount.trim();
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(a) || money(a).lte(0)) return showToast('Enter an amount');
    // The API refuses an over-payment rather than absorbing it.
    if (money(a).gt(selected.balance)) return showToast('Amount exceeds balance');
    setBusy(true);
    try {
      await recordDebtPayment(db, {
        saleId: selected.saleId,
        shopId: selected.shopId,
        amount: toMoney(a),
        method,
        momoReference: momoRef,
        receivedBy: user.id,
      });
      onRecorded({ amount: toMoney(a), method });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={customer !== null} onClose={onClose} title="Record Payment" height="80%">
      {customer ? (
        <View style={{ alignItems: 'center' }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText} color={colors.regalPlum}>
              {(customer.name ?? customer.phone).trim()[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} color={colors.regalPlum}>
            {customer.name ?? customer.phone}
          </Text>
          <Text variant="bodyMd" color={colors.onSurfaceVariant}>
            Balance · GHS {formatGhs(total)}
          </Text>
        </View>
      ) : null}

      {debts.length > 1 ? (
        <View>
          <Text style={styles.label} color={colors.onSurfaceVariant}>
            Which Sale
          </Text>
          <View style={{ gap: 8 }}>
            {debts.map((d) => (
              <Pressable
                key={d.saleId}
                onPress={() => setSaleId(d.saleId)}
                style={[styles.debt, d.saleId === saleId ? styles.on : styles.off]}
                accessibilityState={{ selected: d.saleId === saleId }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.debtDue} color={d.overdue ? colors.errorCrimson : colors.regalPlum}>
                    {d.overdue ? 'Overdue · ' : ''}Due {dueLabel(d.dueDate)}
                  </Text>
                  <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ letterSpacing: 0, fontFamily: fonts.sans }}>
                    {isOwner && d.shopName ? `${d.shopName} · ` : ''}Sale of GHS {formatGhs(d.totalAmount)}
                  </Text>
                </View>
                <Text style={styles.debtBal} color={colors.regalPlum}>
                  GHS {formatGhs(d.balance)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {selected ? (
        <View>
          <Text style={styles.label} color={colors.onSurfaceVariant}>
            Amount (GHS)
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.outline}
            style={styles.amount}
          />
          <View style={styles.quick}>
            {[...QUICK.filter((q) => money(q).lt(selected.balance)), 'full'].map((q) => (
              <Pressable key={q} onPress={() => setAmount(q === 'full' ? selected.balance : q)} style={styles.quickBtn}>
                <Text style={styles.quickText} color={colors.regalPlum}>
                  {q === 'full' ? 'Full' : q}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label} color={colors.onSurfaceVariant}>
            Payment Method
          </Text>
          <View style={styles.methods}>
            {(['cash', 'momo'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMethod(m)} style={[styles.method, method === m ? styles.on : styles.off]}>
                <Text style={styles.methodText} color={method === m ? colors.regalPlum : colors.onSurfaceVariant}>
                  {m === 'cash' ? 'Cash' : 'MoMo'}
                </Text>
              </Pressable>
            ))}
          </View>
          {method === 'momo' ? (
            <TextInput
              value={momoRef}
              onChangeText={setMomoRef}
              placeholder="MoMo reference"
              placeholderTextColor={colors.outline}
              autoCapitalize="characters"
              style={styles.momo}
            />
          ) : null}
          <GoldButton label="Record Payment" onPress={submit} loading={busy} />
        </View>
      ) : (
        <Text color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>
          No open balance for this customer.
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.lavenderMist, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 20 },
  name: { fontFamily: fonts.sansSemi, fontSize: 18 },
  label: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  debt: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 2, borderRadius: radius.xl },
  debtDue: { fontFamily: fonts.sansSemi, fontSize: 14 },
  debtBal: { fontFamily: fonts.sansBold, fontSize: 14 },
  on: { borderColor: colors.monarchGold, backgroundColor: 'rgba(243,232,245,0.3)' },
  off: { borderColor: colors.lavenderMist },
  amount: {
    fontFamily: fonts.sansBold,
    fontSize: 30,
    color: colors.regalPlum,
    backgroundColor: 'rgba(243,232,245,0.4)',
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  quick: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lavenderMist, alignItems: 'center' },
  quickText: { fontFamily: fonts.sansSemi, fontSize: 12 },
  methods: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  method: { flex: 1, paddingVertical: 12, borderWidth: 2, borderRadius: radius.xl, alignItems: 'center' },
  methodText: { fontFamily: fonts.sansSemi, fontSize: 14 },
  momo: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.regalPlum,
    backgroundColor: 'rgba(243,232,245,0.5)',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
});
