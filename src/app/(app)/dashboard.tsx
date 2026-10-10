import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useDashboard } from '@/dashboard/use-dashboard';
import { formatGhs, money } from '@/lib/money';
import { colors, fonts, radius } from '@/theme/tokens';

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Accra' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' });
}

/**
 * `renderDashboard()` — "Premier Overview". Owner only (the route is
 * guarded). Figures are the server's live aggregates for today.
 *
 * Differs from the prototype where the API has nothing behind a figure:
 * "+12.5% from yesterday" becomes credit extended today, and a sale's
 * receipt number (the API has none) becomes its time.
 */
export default function DashboardScreen() {
  const { data, loading, error, load } = useDashboard();
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const t = data?.summary.totals;
  const shops = data?.summary.shops.filter((s) => s.isActive) ?? [];
  const maxRev = Math.max(...shops.map((s) => Number(s.revenue)), 1);
  const low = data?.lowStock.data.filter((r) => !r.oversold) ?? [];
  const oversold = data?.oversold.data ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        // Spinner follows the user's pull only (see usePullToSync for why).
        <RefreshControl
          refreshing={pulling}
          onRefresh={async () => {
            setPulling(true);
            await load();
            setPulling(false);
          }}
          tintColor={colors.regalPlum}
          colors={[colors.regalPlum]}
        />
      }>
      <View style={styles.headRow}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="eyebrow" color={colors.onSurfaceVariant}>
            Executive Dashboard
          </Text>
          <Text style={styles.h2} color={colors.regalPlum}>
            Premier Overview
          </Text>
        </View>
        <View style={styles.dateCard}>
          <Icon name="calendar-today" size={18} color={colors.monarchGold} />
          <View>
            <Text style={styles.dateLabel} color={colors.onSurfaceVariant}>
              TODAY
            </Text>
            <Text style={styles.dateValue} color={colors.onSurface}>
              {todayLabel()}
            </Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.notice}>
          <Icon name="cloud-off" size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.noticeText} color={colors.onSurfaceVariant}>
            {data
              ? `Couldn't refresh (${error}). Showing figures from ${timeLabel(data.fetchedAt)}.`
              : `Couldn't load the dashboard: ${error}`}
          </Text>
        </View>
      ) : null}

      {!data ? (
        <Text color={colors.onSurfaceVariant} style={{ textAlign: 'center', paddingVertical: 32 }}>
          {loading ? 'Loading…' : 'Connect to load today’s figures.'}
        </Text>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.watermark} pointerEvents="none">
              <Icon name="payments" size={56} color="rgba(45,10,49,0.05)" />
            </View>
            <Text style={styles.cardLabel} color={colors.onSurfaceVariant}>
              TOTAL REVENUE
            </Text>
            <View style={styles.bigRow}>
              <Text style={styles.bigCurrency} color={colors.onSurfaceVariant}>
                GHS
              </Text>
              <Text style={styles.big} color={colors.regalPlum}>
                {formatGhs(t!.revenue)}
              </Text>
            </View>
            <View style={styles.subRow}>
              <Icon name="schedule" size={14} color={colors.secondary} />
              <Text style={styles.sub} color={colors.secondary}>
                GHS {formatGhs(t!.creditExtended)} extended on credit today
              </Text>
            </View>
          </View>

          <View style={styles.grid}>
            <View style={[styles.card, styles.half]}>
              <Text style={styles.cardLabel} color={colors.onSurfaceVariant}>
                TRANSACTIONS
              </Text>
              <Text style={styles.mid} color={colors.regalPlum}>
                {t!.transactionCount}
              </Text>
              <Text style={styles.small} color={colors.onSurfaceVariant}>
                {t!.itemsSold} items sold
              </Text>
            </View>
            <View style={[styles.card, styles.half]}>
              <Text style={styles.cardLabel} color={colors.onSurfaceVariant}>
                OUTSTANDING DEBT
              </Text>
              <Text style={styles.midMoney} color={colors.warningAmber}>
                GHS {formatGhs(data.debts.totals.outstanding)}
              </Text>
              <Text style={styles.small} color={colors.onSurfaceVariant}>
                {data.debts.totals.overdueCount} overdue
              </Text>
            </View>
          </View>

          <View style={styles.alerts}>
            <Text style={styles.alertsTitle} color={colors.monarchGold}>
              CRITICAL ALERTS
            </Text>
            {low.slice(0, 2).map((r) => (
              <View key={`${r.shopId}:${r.productId}`} style={styles.alertRow}>
                <Icon name="warning" color={colors.warningAmber} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertMain} color={colors.white}>
                    Low Stock: {r.productName}
                  </Text>
                  <Text style={styles.alertSub} color="rgba(255,255,255,0.6)">
                    {r.quantity} units left · {r.shopName}
                  </Text>
                </View>
              </View>
            ))}
            {oversold.slice(0, 1).map((r) => (
              <View key={`${r.shopId}:${r.productId}`} style={styles.alertRow}>
                <Icon name="error" color={colors.errorCrimson} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertMain} color={colors.white}>
                    Oversold: {r.productName}
                  </Text>
                  <Text style={styles.alertSub} color="rgba(255,255,255,0.6)">
                    {r.quantity} units · {r.shopName}
                  </Text>
                </View>
              </View>
            ))}
            {!low.length && !oversold.length ? (
              <Text style={styles.alertSub} color="rgba(255,255,255,0.7)">
                All stock levels healthy
              </Text>
            ) : null}
          </View>

          <View style={[styles.card, { padding: 0 }]}>
            <View style={styles.listHead}>
              <Text style={styles.h3} color={colors.regalPlum}>
                Recent Sales
              </Text>
              <Text style={styles.live} color={colors.monarchGold}>
                LATEST
              </Text>
            </View>
            {data.recent.map((s, i) => (
              <View key={s.id} style={[styles.saleRow, i === data.recent.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.saleId} color={colors.regalPlum}>
                    {timeLabel(s.deviceRecordedAt)}
                    {s.saleType === 'credit' ? ' · Credit' : ''}
                  </Text>
                  <Text style={styles.small} color={colors.onSurfaceVariant} numberOfLines={1}>
                    {s.items.map((it) => `${it.product?.name ?? 'Item'}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(', ')}
                  </Text>
                </View>
                <Text style={styles.shopChip} color={colors.regalPlum}>
                  {s.shop?.name ?? ''}
                </Text>
                <Text style={styles.saleAmt} color={colors.regalPlum}>
                  GHS {formatGhs(s.totalAmount)}
                </Text>
              </View>
            ))}
            {!data.recent.length ? (
              <Text style={[styles.small, { padding: 16 }]} color={colors.onSurfaceVariant}>
                No sales yet.
              </Text>
            ) : null}
          </View>

          <View style={[styles.card, { gap: 16 }]}>
            <Text style={styles.h3} color={colors.regalPlum}>
              Branch Performance
            </Text>
            {shops.map((s) => (
              <View key={s.shopId}>
                <View style={styles.barHead}>
                  <Text style={styles.barName} color={colors.regalPlum}>
                    {s.shopName}
                  </Text>
                  <Text style={styles.small} color={colors.onSurfaceVariant}>
                    GHS {formatGhs(s.revenue)}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(0, money(s.revenue).toNumber() / maxRev) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 20 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  h2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32 },
  h3: { fontFamily: fonts.sansSemi, fontSize: 16 },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateLabel: { fontFamily: fonts.sans, fontSize: 9 },
  dateValue: { fontFamily: fonts.sansSemi, fontSize: 12 },
  notice: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    padding: 10,
  },
  noticeText: { flex: 1, fontFamily: fonts.sans, fontSize: 12 },
  watermark: { position: 'absolute', right: 12, top: 12 },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: colors.lavenderMist },
  cardLabel: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bigCurrency: { fontFamily: fonts.sans, fontSize: 16 },
  big: { fontFamily: fonts.display, fontSize: 36, lineHeight: 46, paddingTop: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  sub: { fontFamily: fonts.sansSemi, fontSize: 12 },
  grid: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, padding: 16 },
  mid: { fontFamily: fonts.display, fontSize: 30, lineHeight: 40 },
  midMoney: { fontFamily: fonts.display, fontSize: 20, lineHeight: 30 },
  small: { fontFamily: fonts.sans, fontSize: 12, marginTop: 2 },
  alerts: { backgroundColor: colors.regalPlum, borderRadius: radius.xl, padding: 20, gap: 12 },
  alertsTitle: { fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 2 },
  alertRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  alertMain: { fontFamily: fonts.sansSemi, fontSize: 14 },
  alertSub: { fontFamily: fonts.sans, fontSize: 12 },
  listHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lavenderMist,
  },
  live: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1 },
  saleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243,232,245,0.6)',
  },
  saleId: { fontFamily: fonts.sansBold, fontSize: 12 },
  shopChip: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    backgroundColor: colors.lavenderMist,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  saleAmt: { fontFamily: fonts.sansBold, fontSize: 12 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barName: { fontFamily: fonts.sansSemi, fontSize: 12 },
  barTrack: { height: 8, backgroundColor: colors.lavenderMist, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.regalPlum, borderRadius: 4 },
});
