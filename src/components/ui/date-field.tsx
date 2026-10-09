import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Icon } from './icon';
import { Text } from './text';

/** `YYYY-MM-DD` ⇄ Date at local midnight. The user picks a calendar day, not an instant. */
function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function display(ymd: string): string {
  return fromYmd(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A calendar-date picker: native compact picker on iOS, the system dialog on Android. */
export function DateField({ value, onChange, minimumDate }: { value: string; onChange: (ymd: string) => void; minimumDate?: string }) {
  const min = minimumDate ? fromYmd(minimumDate) : undefined;

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.box, { paddingVertical: 8 }]}>
        <Icon name="event" size={20} color={colors.monarchGold} />
        <DateTimePicker
          value={fromYmd(value)}
          mode="date"
          display="compact"
          minimumDate={min}
          accentColor={colors.regalPlum}
          onChange={(_, date) => date && onChange(toYmd(date))}
        />
      </View>
    );
  }

  return (
    <Pressable
      style={styles.box}
      accessibilityRole="button"
      onPress={() =>
        DateTimePickerAndroid.open({
          value: fromYmd(value),
          mode: 'date',
          minimumDate: min,
          onChange: (event, date) => {
            if (event.type === 'set' && date) onChange(toYmd(date));
          },
        })
      }>
      <Icon name="event" size={20} color={colors.monarchGold} />
      <Text style={styles.value} color={colors.regalPlum}>
        {display(value)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lavenderMist,
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  value: { fontFamily: fonts.sans, fontSize: 16 },
});
