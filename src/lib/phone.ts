import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/**
 * One phone number, one spelling — the same rule as the backend's
 * `utils/phone.js`, so a number typed on the device matches the server's row
 * and a customer is never created twice. Accepts what people type
 * ("024 400 0000", "+233 24…", "233…", "00233…") and returns the national
 * form, "0244000000". Null when it is not a valid Ghanaian number.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = parsePhoneNumberFromString(value.trim(), 'GH');
  if (!parsed || parsed.country !== 'GH' || !parsed.isValid()) return null;
  return `0${parsed.nationalNumber}`;
}

/** Canonical form when `value` is a phone number, else unchanged (for search boxes). */
export function normalizePhoneIfPossible(value: string): string {
  return normalizePhone(value) ?? value;
}
