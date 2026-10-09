/**
 * Business dates are calendar dates in the shop's timezone. The backend
 * defaults SHOP_TIMEZONE to Africa/Accra (UTC+0, no DST).
 */
export const SHOP_TIMEZONE = 'Africa/Accra';

/** `YYYY-MM-DD` for `date` in the shop's timezone. */
export function calendarDate(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Credit checkout's default due date: 30 days out. The stored value is always explicit. */
export function defaultDueDate(from: Date = new Date()): string {
  return calendarDate(new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000));
}

/** Same rule as the `debts` view: balance > 0 and dueDate before today. */
export function isOverdue(dueDate: string | null, balancePositive: boolean): boolean {
  return balancePositive && !!dueDate && dueDate < calendarDate();
}

/** `deviceRecordedAt` — the business timestamp reports use. */
export function nowIso(): string {
  return new Date().toISOString();
}
