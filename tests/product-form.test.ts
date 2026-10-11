import { emptyProductForm, validateProductForm } from '@/catalog/product-form';

const valid = { ...emptyProductForm, name: ' Bob Wig 12" ', categoryId: 'c1', price: '640' };

it('builds the API body, money as 2-dp strings and blanks as null', () => {
  const r = validateProductForm({ ...valid, costPrice: '480.5', barcode: ' MOR-BIM-24 ', reorderLevel: '4' });
  expect(r).toEqual({
    ok: true,
    reorderLevel: 4,
    input: {
      categoryId: 'c1',
      name: 'Bob Wig 12"',
      barcode: 'MOR-BIM-24',
      defaultPrice: '640.00',
      costPrice: '480.50',
      wholesalePrice: null,
      wholesaleMinQuantity: null,
    },
  });
});

it('requires a name, category and valid price', () => {
  const r = validateProductForm({ ...emptyProductForm, name: 'x', price: '12.345' });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['categoryId', 'name', 'price']);
});

it('takes a wholesale rule only as a price and a minimum of at least 2', () => {
  const half = validateProductForm({ ...valid, wholesalePrice: '500' });
  expect(half.ok).toBe(false);
  const one = validateProductForm({ ...valid, wholesalePrice: '500', wholesaleMinQuantity: '1' });
  expect(one.ok).toBe(false);
  const both = validateProductForm({ ...valid, wholesalePrice: '500', wholesaleMinQuantity: '5' });
  expect(both.ok && both.input).toMatchObject({ wholesalePrice: '500.00', wholesaleMinQuantity: 5 });
});
