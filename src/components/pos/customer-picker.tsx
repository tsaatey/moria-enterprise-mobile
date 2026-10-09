import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CustomerForm } from '@/components/customers/customer-form';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { type LocalCustomer, searchCustomers } from '@/db/customers';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Customer section of `renderPayment()`. For credit, only full-tier
 * customers are listed. Adds search and an inline "New Customer" form, which
 * the prototype's fixed list does not have: spec § Key Features asks for
 * customer capture at checkout.
 */
export function CustomerPicker({
  credit,
  selected,
  onSelect,
}: {
  credit: boolean;
  selected: LocalCustomer | null;
  onSelect: (c: LocalCustomer | null) => void;
}) {
  const db = useSQLiteContext();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<LocalCustomer[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (selected) return;
    let live = true;
    void searchCustomers(db, { search, creditOnly: credit, limit: 20 }).then((rows) => live && setResults(rows));
    return () => {
      live = false;
    };
  }, [db, search, credit, selected]);

  const header = (
    <View style={styles.head}>
      <Text style={styles.heading} color={colors.regalPlum}>
        Customer{' '}
        {credit ? (
          <Text style={styles.heading} color={colors.errorCrimson}>
            *
          </Text>
        ) : (
          <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ opacity: 0.6, letterSpacing: 0 }}>
            (optional)
          </Text>
        )}
      </Text>
      {selected ? (
        <Pressable onPress={() => onSelect(null)} hitSlop={8}>
          <Text style={styles.link} color={colors.errorCrimson}>
            Clear
          </Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => setAdding((a) => !a)} hitSlop={8}>
          <Text style={styles.link} color={colors.monarchGold}>
            {adding ? 'Cancel' : 'New Customer'}
          </Text>
        </Pressable>
      )}
    </View>
  );

  if (selected) {
    return (
      <View>
        {header}
        <View style={styles.selected}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText} color={colors.regalPlum}>
              {(selected.name ?? selected.phone).trim()[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} color={colors.regalPlum}>
              {selected.name ?? selected.phone}
            </Text>
            {selected.name ? (
              <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ letterSpacing: 0 }}>
                {selected.phone}
              </Text>
            ) : null}
          </View>
          <Icon name="check-circle" color={colors.successEmerald} />
        </View>
      </View>
    );
  }

  return (
    <View>
      {header}
      {adding ? (
        <CustomerForm
          requireCredit={credit}
          initialPhone={/^[+\d\s]+$/.test(search) ? search : ''}
          onSaved={(c) => {
            setAdding(false);
            onSelect(c);
          }}
        />
      ) : (
        <>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.onSurfaceVariant} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or phone…"
              placeholderTextColor={colors.outline}
              style={styles.searchInput}
            />
          </View>
          <View style={{ gap: 8 }}>
            {results.slice(0, 6).map((c) => (
              <Pressable key={c.id} onPress={() => onSelect(c)} style={({ pressed }) => [styles.option, pressed && { borderColor: colors.monarchGold }]}>
                <Text style={styles.optionName} color={colors.regalPlum}>
                  {c.name ?? c.phone}
                </Text>
                {c.name ? (
                  <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ letterSpacing: 0, fontFamily: fonts.sans }}>
                    {c.phone}
                  </Text>
                ) : null}
              </Pressable>
            ))}
            {!results.length ? (
              <Text variant="bodyMd" color={colors.onSurfaceVariant}>
                No matching customers.
              </Text>
            ) : null}
          </View>
          {credit ? (
            <View style={styles.warn}>
              <Icon name="warning" size={14} color={colors.errorCrimson} />
              <Text variant="labelMd" color={colors.errorCrimson} style={{ letterSpacing: 0, fontFamily: fonts.sans }}>
                Customer with name + address required
              </Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heading: { fontFamily: fonts.sansSemi, fontSize: 14 },
  link: { fontFamily: fonts.sansSemi, fontSize: 12 },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
    borderRadius: radius.xl,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lavenderMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 16 },
  name: { fontFamily: fonts.sansSemi, fontSize: 14 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(243,232,245,0.5)',
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.regalPlum, padding: 0 },
  option: {
    padding: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
    borderRadius: radius.lg,
  },
  optionName: { fontFamily: fonts.sansSemi, fontSize: 12 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
});
