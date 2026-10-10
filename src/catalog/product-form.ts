import type { ProductInput } from '@/api/catalog';
import { toMoney } from '@/lib/money';

/** What the Add/Edit Product form holds: strings, as typed. */
export interface ProductFormValues {
  name: string;
  categoryId: string | null;
  price: string;
  barcode: string;
  reorderLevel: string;
  costPrice: string;
  wholesalePrice: string;
  wholesaleMinQuantity: string;
}

export const emptyProductForm: ProductFormValues = {
  name: '',
  categoryId: null,
  price: '',
  barcode: '',
  reorderLevel: '',
  costPrice: '',
  wholesalePrice: '',
  wholesaleMinQuantity: '',
};

// The backend's rules (validations/product-validations.js), checked here so
// the owner hears about a mistake before the request is sent.
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>>;

export function validateProductForm(
  v: ProductFormValues,
): { ok: true; input: ProductInput; reorderLevel: number | null } | { ok: false; errors: ProductFormErrors } {
  const errors: ProductFormErrors = {};
  const name = v.name.trim();
  if (name.length < 2 || name.length > 200) errors.name = 'Name must be 2–200 characters';
  if (!v.categoryId) errors.categoryId = 'Choose a category';
  if (!MONEY.test(v.price.trim())) errors.price = 'Enter a price like 850.00';
  const barcode = v.barcode.trim();
  if (barcode.length > 64) errors.barcode = 'At most 64 characters';

  const cost = v.costPrice.trim();
  if (cost && !MONEY.test(cost)) errors.costPrice = 'Enter an amount like 600.00';

  const wp = v.wholesalePrice.trim();
  const wm = v.wholesaleMinQuantity.trim();
  if (wp || wm) {
    // A wholesale rule is a fixed price from a minimum: both or neither.
    if (!MONEY.test(wp)) errors.wholesalePrice = 'Enter a wholesale price, or clear both wholesale fields';
    if (!/^\d+$/.test(wm) || Number(wm) < 2 || Number(wm) > 100000)
      errors.wholesaleMinQuantity = 'Wholesale starts from 2 units or more';
  }

  const rl = v.reorderLevel.trim();
  if (rl && !/^\d+$/.test(rl)) errors.reorderLevel = 'A whole number of units';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      categoryId: v.categoryId!,
      name,
      barcode: barcode || null,
      defaultPrice: toMoney(v.price.trim()),
      costPrice: cost ? toMoney(cost) : null,
      wholesalePrice: wp ? toMoney(wp) : null,
      wholesaleMinQuantity: wm ? Number(wm) : null,
    },
    reorderLevel: rl ? Number(rl) : null,
  };
}
