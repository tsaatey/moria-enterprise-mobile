import { normalizePhone, normalizePhoneIfPossible } from '@/lib/phone';

describe('normalizePhone (mirrors the backend utils/phone.js)', () => {
  it.each(['0244000000', '024 400 0000', '+233244000000', '+233 24 400 0000', '233244000000', '00233244000000'])(
    '%s → 0244000000',
    (input) => expect(normalizePhone(input)).toBe('0244000000'),
  );
  it('refuses non-Ghanaian and impossible numbers', () => {
    expect(normalizePhone('+447700900123')).toBeNull();
    expect(normalizePhone('0000000000')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
  it('leaves non-phone search text alone', () => {
    expect(normalizePhoneIfPossible('Ama')).toBe('Ama');
  });
});
