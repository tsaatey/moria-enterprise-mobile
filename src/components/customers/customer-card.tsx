import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { type CustomerListRow, isCreditEligible } from '@/db/customers';
import { formatGhs } from '@/lib/money';
import { colors, fonts, radius } from '@/theme/tokens';

export interface CustomerDebtSummary {
  balance: string;
  overdue: boolean;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** A customer card from `renderCustomers()`. */
export const CustomerCard = memo(function CustomerCard({
  customer,
  debt,
  onTakePayment,
  onCompleteProfile,
}: {
  customer: CustomerListRow;
  debt: CustomerDebtSummary | undefined;
  onTakePayment: (c: CustomerListRow) => void;
  onCompleteProfile: (c: CustomerListRow) => void;
}) {
  const owes = !!debt;
  const badge = !owes
    ? { label: 'Clear', bg: 'rgba(27,94,32,0.1)', fg: colors.successEmerald }
    : debt.overdue
      ? { label: 'Overdue', bg: colors.errorContainer, fg: colors.onErrorContainer }
      : { label: 'Owes', bg: colors.secondaryContainer, fg: colors.onSecondaryContainer };

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.who}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText} color={colors.regalPlum}>
              {(customer.name ?? '?').trim()[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.name} color={colors.regalPlum} numberOfLines={1}>
              {customer.name || 'Phone only'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.phone} color={colors.onSurfaceVariant}>
                {customer.phone}
              </Text>
              {customer.syncStatus !== 'synced' ? (
                <Icon name="cloud-queue" size={14} color={customer.syncStatus === 'rejected' ? colors.error : colors.outline} />
              ) : null}
            </View>
          </View>
        </View>
        <Text style={[styles.badge, { backgroundColor: badge.bg }]} color={badge.fg}>
          {badge.label.toUpperCase()}
        </Text>
      </View>

      {owes ? (
        <>
          <View style={styles.owed}>
            <Text style={styles.owedLabel} color={colors.outline}>
              AMOUNT OWED
            </Text>
            <Text style={styles.owedValue} color={colors.regalPlum}>
              GHS {formatGhs(debt.balance)}
            </Text>
          </View>
          <Pressable
            onPress={() => onTakePayment(customer)}
            style={({ pressed }) => [styles.pay, pressed && { opacity: 0.85 }]}
            accessibilityRole="button">
            <Icon name="payments" size={18} />
            <Text style={styles.payText} color={colors.regalPlum}>
              Take Payment
            </Text>
          </Pressable>
        </>
      ) : customer.lastPurchaseAt ? (
        <Text style={styles.phone} color={colors.onSurfaceVariant}>
          Last purchase · {shortDate(customer.lastPurchaseAt)}
        </Text>
      ) : null}

      {!isCreditEligible(customer) ? (
        <Pressable onPress={() => onCompleteProfile(customer)} hitSlop={6} style={styles.complete}>
          <Icon name="edit" size={14} color={colors.secondary} />
          <Text style={styles.completeText} color={colors.secondary}>
            Add name & address for credit
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.lavenderMist },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lavenderMist, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 16 },
  name: { fontFamily: fonts.sansSemi, fontSize: 16 },
  phone: { fontFamily: fonts.sans, fontSize: 12 },
  badge: { fontFamily: fonts.sansBold, fontSize: 9, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, overflow: 'hidden' },
  owed: {
    padding: 12,
    backgroundColor: colors.silkWhite,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.monarchGold,
    marginBottom: 12,
  },
  owedLabel: { fontFamily: fonts.sansSemi, fontSize: 9 },
  owedValue: { fontFamily: fonts.sansBold, fontSize: 18 },
  pay: {
    paddingVertical: 12,
    backgroundColor: colors.monarchGold,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payText: { fontFamily: fonts.sansBold, fontSize: 14 },
  complete: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  completeText: { fontFamily: fonts.sansSemi, fontSize: 12 },
});
