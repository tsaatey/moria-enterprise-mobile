import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { SyncIssue } from '@/db/sync-issues';
import { formatGhs } from '@/lib/money';
import { colors, fonts, radius } from '@/theme/tokens';

const TYPE_LABEL = { sale: 'Sale', payment: 'Payment', customer: 'Customer' } as const;

/**
 * Records the server refused (§ Offline Sync Protocol: "stays queued on the
 * device for correction"). Not in the prototype. A credit sale refused for
 * CUSTOMER_INCOMPLETE is fixed by completing the customer; anything else can
 * be retried once whatever caused it is sorted.
 */
export function SyncIssuesPanel({
  issues,
  onFixCustomer,
  onRetry,
}: {
  issues: SyncIssue[];
  onFixCustomer: (issue: SyncIssue) => void;
  onRetry: (issue: SyncIssue) => void;
}) {
  if (!issues.length) return null;
  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Icon name="error-outline" size={18} color={colors.onErrorContainer} />
        <Text style={styles.title} color={colors.onErrorContainer}>
          {issues.length} {issues.length === 1 ? 'record needs' : 'records need'} attention
        </Text>
      </View>
      {issues.map((i) => {
        const needsCustomer = i.code === 'CUSTOMER_INCOMPLETE' && !!i.customerId;
        return (
          <View key={`${i.type}:${i.id}`} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.what} color={colors.regalPlum}>
                {TYPE_LABEL[i.type]}
                {i.amount ? ` · GHS ${formatGhs(i.amount)}` : ''}
                {i.customerLabel ? ` · ${i.customerLabel}` : ''}
              </Text>
              <Text style={styles.why} color={colors.onSurfaceVariant}>
                {i.message ?? i.code}
              </Text>
            </View>
            <Pressable
              onPress={() => (needsCustomer ? onFixCustomer(i) : onRetry(i))}
              style={styles.action}
              accessibilityRole="button">
              <Text style={styles.actionText} color={colors.regalPlum}>
                {needsCustomer ? 'Complete' : 'Retry'}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.errorContainer, borderRadius: radius.xl, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.sansBold, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: radius.lg, padding: 10 },
  what: { fontFamily: fonts.sansSemi, fontSize: 13 },
  why: { fontFamily: fonts.sans, fontSize: 12, marginTop: 2 },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg, backgroundColor: colors.monarchGold },
  actionText: { fontFamily: fonts.sansBold, fontSize: 12 },
});
