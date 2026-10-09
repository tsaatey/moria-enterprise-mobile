import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { PaymentMethod } from '@/api/types';
import { useSession } from '@/auth/session-store';
import { DateField } from '@/components/ui/date-field';
import { GoldButton } from '@/components/ui/gold-button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { isCreditEligible, type LocalCustomer } from '@/db/customers';
import { recordSale } from '@/db/sales';
import { calendarDate, defaultDueDate } from '@/lib/dates';
import { formatGhs, money, toMoney } from '@/lib/money';
import { priceCart, useCart } from '@/pos/cart-store';
import { colors, fonts, radius } from '@/theme/tokens';

import { CustomerPicker } from './customer-picker';

type Method = PaymentMethod | 'credit';

const METHODS: { id: Method; icon: IconName; label: string; full?: boolean }[] = [
  { id: 'cash', icon: 'payments', label: 'Cash' },
  { id: 'momo', icon: 'smartphone', label: 'MoMo' },
  { id: 'credit', icon: 'calendar-month', label: 'Credit', full: true },
];

/**
 * `renderPayment()` — "Process Payment". Additions to the prototype, all
 * backed by the API: quantity steppers and wholesale pricing per line, an
 * optional deposit on a credit sale, and customer search/capture.
 */
export function PaymentSheet({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (summary: { total: string; method: Method }) => void;
}) {
  const db = useSQLiteContext();
  const user = useSession((s) => s.user)!;
  const { shopId, lines, setQuantity, remove, clear } = useCart();
  const cart = priceCart(lines);

  const [method, setMethod] = useState<Method>('cash');
  const [momoRef, setMomoRef] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [customer, setCustomer] = useState<LocalCustomer | null>(null);
  const [deposit, setDeposit] = useState('');
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('cash');
  const [busy, setBusy] = useState(false);

  const isCredit = method === 'credit';

  const choose = (m: Method) => {
    setMethod(m);
    // A customer picked for a cash sale may not be complete enough for credit.
    if (m === 'credit' && customer && !isCreditEligible(customer)) setCustomer(null);
  };

  const complete = async () => {
    if (!shopId || !cart.lines.length) return;
    let payment: { amount: string; method: PaymentMethod; momoReference: string | null } | null;

    if (isCredit) {
      if (!customer) return showToast('Select a customer for credit');
      if (!isCreditEligible(customer)) return showToast('Customer needs name and address');
      if (!dueDate) return showToast('Set a due date for credit');
      const d = deposit.trim();
      if (d) {
        if (!/^\d{1,10}(\.\d{1,2})?$/.test(d) || money(d).lte(0)) return showToast('Deposit must be an amount like 200.00');
        if (money(d).gt(cart.total)) return showToast('Deposit is more than the total');
        payment = { amount: toMoney(d), method: depositMethod, momoReference: depositMethod === 'momo' ? momoRef : null };
      } else {
        payment = null;
      }
    } else {
      payment = { amount: cart.total, method, momoReference: method === 'momo' ? momoRef : null };
    }

    setBusy(true);
    try {
      const { totalAmount } = await recordSale(db, {
        shopId,
        userId: user.id,
        saleType: isCredit ? 'credit' : 'fullPayment',
        customerId: customer?.id ?? null,
        dueDate: isCredit ? dueDate : null,
        lines: cart.lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          subtotal: l.subtotal,
          priceTier: l.priceTier,
          retailPrice: l.product.retailPrice,
        })),
        payment,
      });
      clear();
      setMethod('cash');
      setMomoRef('');
      setDueDate(defaultDueDate());
      setCustomer(null);
      setDeposit('');
      onComplete({ total: totalAmount, method });
    } catch (e) {
      showToast(`Could not record sale: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const showMomoRef = method === 'momo' || (isCredit && deposit.trim() !== '' && depositMethod === 'momo');

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Transaction Flow" title="Process Payment">
      <View>
        <Text style={styles.h3} color={colors.regalPlum}>
          Payment Method
        </Text>
        <View style={styles.methods}>
          {METHODS.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => choose(m.id)}
              accessibilityState={{ selected: method === m.id }}
              style={[styles.method, m.full && { width: '100%' }, method === m.id ? styles.methodOn : styles.methodOff]}>
              <Icon name={m.icon} size={26} />
              <Text style={styles.methodLabel} color={colors.regalPlum}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {method === 'momo' ? <MomoRef value={momoRef} onChange={setMomoRef} /> : null}
      </View>

      {isCredit ? (
        <View style={styles.credit}>
          <View>
            <Text variant="eyebrow" color={colors.regalPlum} style={{ fontFamily: fonts.sansBold, marginBottom: 4 }}>
              Credit sale
            </Text>
            <Text style={styles.h3} color={colors.regalPlum}>
              Due Date <Text color={colors.errorCrimson}>*</Text>
            </Text>
            <DateField value={dueDate} onChange={setDueDate} minimumDate={calendarDate()} />
            <Text style={styles.hint} color={colors.onSurfaceVariant}>
              When should this balance be paid? Defaults to +30 days.
            </Text>
          </View>
          <CustomerPicker credit selected={customer} onSelect={setCustomer} />
          <View>
            <Text style={styles.h3} color={colors.regalPlum}>
              Deposit <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ letterSpacing: 0 }}>(optional)</Text>
            </Text>
            <View style={styles.depositRow}>
              <View style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <Text style={styles.methodLabel} color={colors.onSurfaceVariant}>
                  GHS
                </Text>
                <TextInput
                  value={deposit}
                  onChangeText={setDeposit}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.outline}
                  style={styles.inputText}
                />
              </View>
              {(['cash', 'momo'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setDepositMethod(m)}
                  style={[styles.depositMethod, depositMethod === m ? styles.methodOn : styles.methodOff]}>
                  <Text style={styles.methodLabel} color={colors.regalPlum}>
                    {m === 'cash' ? 'Cash' : 'MoMo'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {showMomoRef ? <MomoRef value={momoRef} onChange={setMomoRef} /> : null}
          </View>
        </View>
      ) : (
        <CustomerPicker credit={false} selected={customer} onSelect={setCustomer} />
      )}

      <View>
        <Text style={styles.h3} color={colors.regalPlum}>
          Current Order
        </Text>
        <View style={{ gap: 8 }}>
          {cart.lines.map((l) => {
            const min = l.product.wholesaleMinQuantity;
            return (
              <View key={l.product.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName} color={colors.regalPlum} numberOfLines={2}>
                    {l.quantity}× {l.product.name}
                  </Text>
                  {l.priceTier === 'wholesale' ? (
                    <Text style={styles.lineHint} color={colors.secondary}>
                      Wholesale · GHS {formatGhs(l.unitPrice)} each
                    </Text>
                  ) : l.product.wholesalePrice && min ? (
                    <Text style={styles.lineHint} color={colors.onSurfaceVariant}>
                      GHS {formatGhs(l.product.wholesalePrice)} each from {min}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.stepper}>
                  <Pressable onPress={() => setQuantity(l.product.id, l.quantity - 1)} hitSlop={6} accessibilityLabel="Decrease quantity">
                    <Icon name="remove" size={18} />
                  </Pressable>
                  <Text style={styles.qty} color={colors.regalPlum}>
                    {l.quantity}
                  </Text>
                  <Pressable onPress={() => setQuantity(l.product.id, l.quantity + 1)} hitSlop={6} accessibilityLabel="Increase quantity">
                    <Icon name="add" size={18} />
                  </Pressable>
                </View>
                <Text style={styles.lineTotal} color={colors.onSurface}>
                  GHS {formatGhs(l.subtotal)}
                </Text>
                <Pressable
                  onPress={() => {
                    remove(l.product.id);
                    if (cart.lines.length === 1) onClose();
                  }}
                  hitSlop={6}
                  accessibilityLabel={`Remove ${l.product.name}`}>
                  <Icon name="remove-circle" size={20} color={colors.outline} />
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.total}>
        <View style={styles.totalRow}>
          <Text style={styles.totalText} color={colors.white}>
            Total
          </Text>
          <Text style={styles.totalText} color={colors.white}>
            GHS {formatGhs(cart.total)}
          </Text>
        </View>
        {isCredit && dueDate ? (
          <Text variant="labelMd" color={colors.monarchGold} style={{ marginTop: 8, letterSpacing: 0 }}>
            Due {dueDate}
          </Text>
        ) : null}
      </View>

      <GoldButton label="Complete Sale" icon="check" onPress={complete} loading={busy} />
    </Sheet>
  );
}

function MomoRef({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ letterSpacing: 0 }}>
        MoMo Reference
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="TXN-992-XXXXX"
        placeholderTextColor={colors.outline}
        autoCapitalize="characters"
        style={[styles.input, styles.inputText, { marginTop: 4 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h3: { fontFamily: fonts.sansSemi, fontSize: 16, marginBottom: 12 },
  hint: { fontFamily: fonts.sans, fontSize: 10, marginTop: 6 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  method: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderRadius: radius.xl,
    gap: 4,
  },
  methodOn: { borderColor: colors.monarchGold, backgroundColor: 'rgba(243,232,245,0.4)' },
  methodOff: { borderColor: colors.lavenderMist },
  methodLabel: { fontFamily: fonts.sansSemi, fontSize: 14 },
  credit: {
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: colors.monarchGold,
    backgroundColor: 'rgba(243,232,245,0.3)',
    padding: 16,
    gap: 16,
  },
  depositRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  depositMethod: { borderWidth: 2, borderRadius: radius.lg, paddingHorizontal: 12, justifyContent: 'center' },
  input: {
    backgroundColor: 'rgba(243,232,245,0.5)',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputText: { fontFamily: fonts.sans, fontSize: 16, color: colors.regalPlum, flex: 1, padding: 0 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
  },
  lineName: { fontFamily: fonts.sansSemi, fontSize: 14 },
  lineHint: { fontFamily: fonts.sans, fontSize: 11, marginTop: 2 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.lavenderMist,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qty: { fontFamily: fonts.sansBold, fontSize: 14, minWidth: 18, textAlign: 'center' },
  lineTotal: { fontFamily: fonts.sansBold, fontSize: 14 },
  total: { backgroundColor: colors.regalPlum, padding: 20, borderRadius: radius['2xl'] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalText: { fontFamily: fonts.sansBold, fontSize: 18 },
});
