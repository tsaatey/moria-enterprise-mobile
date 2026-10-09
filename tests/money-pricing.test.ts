import { formatGhs, lineSubtotal, sumMoney } from '@/lib/money';
import { priceLine } from '@/pos/pricing';

describe('money', () => {
  it('adds without float drift', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
  });
  it('computes a line subtotal the server will accept', () => {
    expect(lineSubtotal(3, '33.33')).toBe('99.99');
  });
  it('formats with thousands separators', () => {
    expect(formatGhs('1450')).toBe('1,450.00');
    expect(formatGhs('-1234567.5')).toBe('-1,234,567.50');
  });
});

describe('priceLine', () => {
  const product = { retailPrice: '850.00', wholesalePrice: '700.00', wholesaleMinQuantity: 5 };

  it('charges retail below the wholesale minimum', () => {
    expect(priceLine(product, 4)).toEqual({ unitPrice: '850.00', subtotal: '3400.00', priceTier: 'retail' });
  });
  it('charges every unit wholesale once the line reaches the minimum', () => {
    expect(priceLine(product, 5)).toEqual({ unitPrice: '700.00', subtotal: '3500.00', priceTier: 'wholesale' });
  });
  it('stays retail when the product has no wholesale price', () => {
    expect(priceLine({ retailPrice: '75.00', wholesalePrice: null, wholesaleMinQuantity: null }, 50).priceTier).toBe('retail');
  });
});
