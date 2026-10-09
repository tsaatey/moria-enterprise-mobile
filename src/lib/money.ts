import { Decimal } from 'decimal.js';

/**
 * Money is GHS, 2 dp, carried on the wire as a string ("450.00") and stored
 * locally as TEXT. Never do arithmetic on it as a JS float — the backend's
 * NUMERIC(12,2) and decimal.js exist to prevent exactly that.
 */
export type Money = string;

export function money(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/** Serialise for the API and SQLite: always two decimal places. */
export function toMoney(value: Decimal.Value): Money {
  return new Decimal(value).toFixed(2);
}

export function sumMoney(values: Decimal.Value[]): Money {
  return toMoney(values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0)));
}

/** `quantity × unitPrice`, which the server re-verifies on every sale line. */
export function lineSubtotal(quantity: number, unitPrice: Decimal.Value): Money {
  return toMoney(new Decimal(unitPrice).times(quantity));
}

/** Display form used throughout the prototype: "1,450.00" (prefix "GHS" in the UI). */
export function formatGhs(value: Decimal.Value): string {
  const [whole, frac] = new Decimal(value).toFixed(2).split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digits = sign ? whole.slice(1) : whole;
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}
