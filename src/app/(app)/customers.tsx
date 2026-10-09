import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useSession } from '@/auth/session-store';
import { CompleteProfileForm } from '@/components/customers/complete-profile-form';
import { CustomerCard, type CustomerDebtSummary } from '@/components/customers/customer-card';
import { CustomerForm } from '@/components/customers/customer-form';
import { RecordPaymentSheet } from '@/components/customers/record-payment-sheet';
import { SyncIssuesPanel } from '@/components/customers/sync-issues-panel';
import { Chip } from '@/components/ui/chip';
import { usePullToSync } from '@/components/ui/pull-to-sync';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { SuccessModal } from '@/components/ui/success-modal';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { type CustomerListRow, getCustomer, type LocalCustomer, listCustomers, listCustomersByIds } from '@/db/customers';
import { getOpenDebts, type OpenDebt } from '@/db/debts';
import { getMeta } from '@/db/meta';
import { listSyncIssues, requeue, type SyncIssue } from '@/db/sync-issues';
import { formatGhs, money, toMoney } from '@/lib/money';
import { useSyncStore } from '@/sync/sync-store';
import { colors, fonts, radius } from '@/theme/tokens';

type Filter = 'all' | 'debtors' | 'overdue';

/**
 * `renderCustomers()` — "Customer Relations". Reads SQLite only: customers
 * from the sync pull, balances from the cached `GET /debts` plus this
 * device's unsynced sales and payments.
 *
 * Additions to the prototype: search, an Overdue chip, per-sale payment,
 * "Add name & address" for credit, and the records the server refused.
 */
export default function CustomersScreen() {
  const db = useSQLiteContext();
  const user = useSession((s) => s.user)!;
  const { dataVersion, requestSync } = useSyncStore();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerListRow[]>([]);
  const [debts, setDebts] = useState<OpenDebt[]>([]);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [debtsFetchedAt, setDebtsFetchedAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<CustomerListRow | null>(null);
  const [completing, setCompleting] = useState<{ customer: LocalCustomer; issue?: SyncIssue } | null>(null);
  const [success, setSuccess] = useState<{ title: string; message: string } | null>(null);

  const pullToSync = usePullToSync();
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useFocusEffect(reload);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [open, found, fetched] = await Promise.all([getOpenDebts(db), listSyncIssues(db, user.id), getMeta(db, 'debtsFetchedAt')]);
      if (!live) return;
      setDebts(open);
      setIssues(found);
      setDebtsFetchedAt(fetched);
    })();
    return () => {
      live = false;
    };
  }, [db, user.id, dataVersion, tick]);

  const byCustomer = useMemo(() => {
    const m = new Map<string, CustomerDebtSummary>();
    for (const d of debts) {
      const cur = m.get(d.customerId);
      m.set(d.customerId, {
        balance: toMoney(money(cur?.balance ?? 0).plus(d.balance)),
        overdue: (cur?.overdue ?? false) || d.overdue,
      });
    }
    return m;
  }, [debts]);

  useEffect(() => {
    let live = true;
    const ids = [...byCustomer.entries()].filter(([, s]) => filter === 'debtors' || s.overdue).map(([id]) => id);
    const load =
      filter === 'all'
        ? listCustomers(db, { search })
        : listCustomersByIds(db, ids, search).then((rows) =>
            // Biggest balance first: the list is who to chase.
            rows.sort((a, b) => money(byCustomer.get(b.id)!.balance).comparedTo(byCustomer.get(a.id)!.balance)),
          );
    void load.then((rows) => live && setCustomers(rows));
    return () => {
      live = false;
    };
  }, [db, filter, search, byCustomer, dataVersion, tick]);

  const totalDebt = toMoney(debts.reduce((s, d) => s.plus(d.balance), money(0)));
  const debtorCount = byCustomer.size;
  const overdueCount = [...byCustomer.values()].filter((s) => s.overdue).length;

  const afterLocalWrite = () => {
    reload();
    requestSync?.();
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <View>
        <Text style={styles.h2} color={colors.regalPlum}>
          Customer Relations
        </Text>
        <Text variant="bodyMd" color={colors.onSurfaceVariant}>
          Track clientele and outstanding balances
        </Text>
      </View>

      <SyncIssuesPanel
        issues={issues}
        onRetry={async (i) => {
          await requeue(db, i);
          showToast('Queued to retry');
          afterLocalWrite();
        }}
        onFixCustomer={async (i) => {
          const c = i.customerId ? await getCustomer(db, i.customerId) : null;
          if (c) setCompleting({ customer: c, issue: i });
        }}
      />

      <View style={styles.hero}>
        <Text style={styles.heroLabel} color="rgba(243,232,245,0.7)">
          TOTAL OUTSTANDING
        </Text>
        {/* Two sibling Texts: Android clips a nested Text set in a different font. */}
        <View style={styles.heroValueRow}>
          <Text style={styles.heroCurrency} color={colors.monarchGold}>
            GHS
          </Text>
          <Text style={styles.heroValue} color={colors.white}>
            {formatGhs(totalDebt)}
          </Text>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel} color="rgba(243,232,245,0.7)">
              DEBTORS
            </Text>
            <Text style={styles.heroStatValue} color={colors.white}>
              {debtorCount} Clients
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel} color="rgba(243,232,245,0.7)">
              OVERDUE
            </Text>
            <Text style={styles.heroStatValue} color={colors.monarchGold}>
              {overdueCount} Clients
            </Text>
          </View>
        </View>
        {debtsFetchedAt ? (
          <Text style={styles.asOf} color="rgba(243,232,245,0.6)">
            Balances as of {new Date(debtsFetchedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        ) : (
          <Text style={styles.asOf} color="rgba(243,232,245,0.6)">
            Sync to load balances from the server
          </Text>
        )}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Debtors" selected={filter === 'debtors'} onPress={() => setFilter('debtors')} />
          <Chip label="Overdue" selected={filter === 'overdue'} onPress={() => setFilter('overdue')} />
          <Pressable onPress={() => setAdding(true)} style={styles.add} accessibilityRole="button">
            <Icon name="person-add" size={14} />
            <Text style={styles.addText} color={colors.regalPlum}>
              Add
            </Text>
          </Pressable>
        </ScrollView>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.onSurfaceVariant} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or phone…"
            placeholderTextColor={colors.outline}
            style={styles.searchInput}
            autoCorrect={false}
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={customers}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={pullToSync}
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            debt={byCustomer.get(item.id)}
            onTakePayment={setPaying}
            onCompleteProfile={(c) => setCompleting({ customer: c })}
          />
        )}
        ListEmptyComponent={
          <Text color={colors.onSurfaceVariant} style={{ textAlign: 'center', paddingVertical: 32 }}>
            {search ? 'No customers match your search' : filter === 'all' ? 'No customers yet' : 'Nobody owes anything'}
          </Text>
        }
      />

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add Customer" height="80%">
        <CustomerForm
          onSaved={(_, existing) => {
            setAdding(false);
            showToast(existing ? 'Customer already on file' : 'Customer added');
            afterLocalWrite();
          }}
        />
      </Sheet>

      <Sheet open={completing !== null} onClose={() => setCompleting(null)} title="Complete Customer" height="70%">
        {completing ? (
          <CompleteProfileForm
            customer={completing.customer}
            onSaved={async () => {
              // The refused credit sale goes back in the queue with the completed profile.
              if (completing.issue) await requeue(db, completing.issue);
              setCompleting(null);
              showToast(completing.issue ? 'Saved — sale queued to sync' : 'Customer updated');
              afterLocalWrite();
            }}
          />
        ) : null}
      </Sheet>

      <RecordPaymentSheet
        customer={paying}
        onClose={() => setPaying(null)}
        onRecorded={({ amount, method }) => {
          setPaying(null);
          setSuccess({ title: 'Payment Recorded', message: `GHS ${formatGhs(amount)} received via ${method === 'momo' ? 'MoMo' : 'cash'}` });
          afterLocalWrite();
        }}
      />

      <SuccessModal
        open={success !== null}
        title={success?.title ?? ''}
        message={success?.message ?? ''}
        onContinue={() => setSuccess(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32 },
  hero: { backgroundColor: colors.regalPlum, borderRadius: radius.xl, padding: 20, overflow: 'hidden' },
  heroLabel: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 40, paddingTop: 2 },
  heroCurrency: { fontFamily: fonts.sans, fontSize: 16 },
  heroStats: { flexDirection: 'row', gap: 12, marginTop: 16 },
  heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, padding: 12 },
  heroStatLabel: { fontFamily: fonts.sans, fontSize: 9 },
  heroStatValue: { fontFamily: fonts.sansSemi, fontSize: 14 },
  asOf: { fontFamily: fonts.sans, fontSize: 10, marginTop: 12 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.monarchGold,
  },
  addText: { fontFamily: fonts.sansBold, fontSize: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    marginTop: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.lavenderMist,
    borderRadius: radius.lg,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.regalPlum, padding: 0 },
});
