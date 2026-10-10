import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import * as catalogApi from '@/api/catalog';
import { isApiError } from '@/api/errors';
import { pickCover, uploadCover } from '@/catalog/cover-photo';
import { emptyProductForm, type ProductFormErrors, type ProductFormValues, validateProductForm } from '@/catalog/product-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { GoldButton } from '@/components/ui/gold-button';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { type CatalogProduct, listPosCategories, type PosCategory } from '@/db/catalog';
import { errorMessage } from '@/lib/error-message';
import { colors, fonts, radius } from '@/theme/tokens';

type Cover = { kind: 'none' } | { kind: 'existing'; url: string } | { kind: 'new'; uri: string };

/**
 * The prototype's "Add Product" form (cover photo, name, category, price,
 * barcode, reorder level), also used to edit. Adds what the API carries and
 * the web console's form has: Cost Price (margins), Wholesale Price and
 * Wholesale From (decided 2026-10-09), and Active on edit.
 *
 * Online only: catalog writes are not part of the offline push. Reorder level
 * is per shop, so it is set on the working shop.
 */
export function ProductSheet({
  open,
  product,
  shopId,
  shopName,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Null to add. */
  product: CatalogProduct | null;
  shopId: string | null;
  shopName: string | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<PosCategory[]>([]);
  const [values, setValues] = useState<ProductFormValues>(emptyProductForm);
  const [active, setActive] = useState(true);
  const [cover, setCover] = useState<Cover>({ kind: 'none' });
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void listPosCategories(db).then((rows) => {
      if (!live) return;
      setCategories(rows);
      setValues(
        product
          ? {
              name: product.name,
              categoryId: product.categoryId,
              price: product.defaultPrice,
              barcode: product.barcode ?? '',
              reorderLevel: product.reorderLevel === null ? '' : String(product.reorderLevel),
              costPrice: product.costPrice ?? '',
              wholesalePrice: product.wholesalePrice ?? '',
              wholesaleMinQuantity: product.wholesaleMinQuantity === null ? '' : String(product.wholesaleMinQuantity),
            }
          : { ...emptyProductForm, categoryId: rows[0]?.id ?? null },
      );
      setActive(product ? !!product.isActive : true);
      setCover(product?.coverImageUrl ? { kind: 'existing', url: product.coverImageUrl } : { kind: 'none' });
      setErrors({});
      setFormError(null);
    });
    return () => {
      live = false;
    };
  }, [open, product, db]);

  const set = (k: keyof ProductFormValues) => (text: string) => setValues((v) => ({ ...v, [k]: text }));

  const choosePhoto = async () => {
    try {
      const uri = await pickCover();
      if (uri) setCover({ kind: 'new', uri });
    } catch (e) {
      setFormError(errorMessage(e));
    }
  };

  const save = async () => {
    const result = validateProductForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    try {
      let coverImageAttachmentId: string | undefined;
      if (cover.kind === 'new') {
        setBusy('Uploading photo…');
        coverImageAttachmentId = await uploadCover(cover.uri);
      }
      setBusy('Saving…');
      let saved;
      if (product) {
        const coverChange =
          cover.kind === 'new'
            ? { coverImageAttachmentId }
            : cover.kind === 'none' && product.coverImageUrl
              ? { coverImageUrl: null, coverImageKey: null }
              : {};
        saved = await catalogApi.updateProduct(product.id, { ...result.input, ...coverChange, isActive: active });
      } else {
        saved = await catalogApi.createProduct({ ...result.input, coverImageAttachmentId });
      }
      if (result.reorderLevel !== null && shopId && result.reorderLevel !== product?.reorderLevel) {
        await catalogApi.setShopInventory(shopId, saved.id, { reorderLevel: result.reorderLevel });
      }
      onSaved(product ? 'Product updated' : cover.kind === 'new' ? 'Product added with cover' : 'Product added');
    } catch (e) {
      if (isApiError(e, 'CONFLICT')) setErrors({ barcode: 'Another product already has this barcode' });
      else setFormError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={product ? 'Edit Product' : 'Add Product'} height="90%">
      <View>
        <Text style={styles.label} color={colors.onSurfaceVariant}>
          Cover Photo
        </Text>
        {cover.kind === 'none' ? (
          <Pressable style={styles.drop} onPress={choosePhoto} accessibilityRole="button">
            <Icon name="add-a-photo" size={30} />
            <Text style={styles.dropTitle} color={colors.regalPlum}>
              Upload cover photo
            </Text>
            <Text style={styles.dropHint} color={colors.onSurfaceVariant}>
              JPEG, PNG, or WebP · max 5 MB
            </Text>
          </Pressable>
        ) : (
          <View>
            <View style={styles.preview}>
              <Image source={cover.kind === 'new' ? cover.uri : cover.url} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Pressable style={styles.remove} onPress={() => setCover({ kind: 'none' })} accessibilityLabel="Remove cover photo">
                <Icon name="close" size={18} color={colors.white} />
              </Pressable>
            </View>
            <Pressable onPress={choosePhoto} style={{ alignSelf: 'center', marginTop: 8 }}>
              <Text style={styles.link} color={colors.monarchGold}>
                Replace photo
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View>
        <Field label="Product Name *" value={values.name} onChangeText={set('name')} error={errors.name} autoCapitalize="words" />
        <Text style={styles.label} color={colors.onSurfaceVariant}>
          Category
        </Text>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} selected={values.categoryId === c.id} onPress={() => setValues((v) => ({ ...v, categoryId: c.id }))} />
          ))}
        </View>
        {errors.categoryId ? (
          <Text variant="labelMd" color={colors.error} style={{ marginTop: -8, marginBottom: 12 }}>
            {errors.categoryId}
          </Text>
        ) : null}
        <Field label="Price (GHS) *" value={values.price} onChangeText={set('price')} keyboardType="decimal-pad" placeholder="0.00" error={errors.price} />
        <Field label="Cost Price (GHS)" value={values.costPrice} onChangeText={set('costPrice')} keyboardType="decimal-pad" placeholder="For margins · owner only" error={errors.costPrice} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Wholesale Price" value={values.wholesalePrice} onChangeText={set('wholesalePrice')} keyboardType="decimal-pad" placeholder="0.00" error={errors.wholesalePrice} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Wholesale From" value={values.wholesaleMinQuantity} onChangeText={set('wholesaleMinQuantity')} keyboardType="number-pad" placeholder="units" error={errors.wholesaleMinQuantity} />
          </View>
        </View>
        <Field label="Barcode" value={values.barcode} onChangeText={set('barcode')} autoCapitalize="characters" placeholder="MOR-XXX-01" error={errors.barcode} />
        <Field
          label={shopName ? `Reorder Level · ${shopName}` : 'Reorder Level'}
          value={values.reorderLevel}
          onChangeText={set('reorderLevel')}
          keyboardType="number-pad"
          placeholder="Low-stock alert at"
          error={errors.reorderLevel}
          editable={!!shopId}
        />
        {product ? <Checkbox label="Active — sold at the till and shown in the catalogue" checked={active} onChange={setActive} /> : null}
        {formError ? (
          <Text color={colors.error} style={{ marginBottom: 12 }}>
            {formError}
          </Text>
        ) : null}
        {busy ? (
          <Text variant="labelMd" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginBottom: 8, letterSpacing: 0 }}>
            {busy}
          </Text>
        ) : null}
        <GoldButton label="Save Product" onPress={save} loading={!!busy} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  drop: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.lavenderMist,
    backgroundColor: 'rgba(243,232,245,0.2)',
  },
  dropTitle: { fontFamily: fonts.sansSemi, fontSize: 14 },
  dropHint: { fontFamily: fonts.sans, fontSize: 10 },
  preview: {
    width: 192,
    height: 192,
    alignSelf: 'center',
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.monarchGold,
    backgroundColor: colors.lavenderMist,
  },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.regalPlum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { fontFamily: fonts.sansSemi, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
});
