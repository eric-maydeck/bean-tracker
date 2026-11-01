import { toOrigin } from './roasterWebsites';
import { COFFEE_ORIGIN_FIELDS, type CoffeeOriginFields } from '../types.ts';

export interface ValidatedCoffeeInput extends CoffeeOriginFields {
  roaster: string;
  coffee_name: string;
  origin: string | null;
  roast_level: string | null;
  processing: string | null;
  amount_g: number | null;
  cost: number | null;
  roast_date: string | null;
  frozen_start_date: string | null;
  frozen_end_date: string | null;
  rest_days_low: number | null;
  rest_days_high: number | null;
  image_url: string | null;
  product_url: string | null;
  // Machine-set hidden field (Suggest pick / Fill from URL); blank when the image was typed or cleared.
  image_source_url: string | null;
  decaf: boolean;
  // "Set as roaster default" (CoffeeForm): write image_url as the roaster's default on save.
  set_roaster_default: boolean;
  // Image Suggest pick: the roaster's website, written on save (hidden field).
  roaster_website: string | null;
  // Absent = the form didn't send the field (list inline edit, Add): leave the column alone.
  subscription_id?: number | null;
}

export class CoffeeFormError extends Error {}

function textField(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

export function parseSlugField(formData: FormData): string | null {
  return textField(formData, 'slug');
}

function numberField(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new CoffeeFormError(`${key} must be a number`);
  }
  return n;
}

function dateField(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new CoffeeFormError(`${key} must be a valid date`);
  }
  return raw;
}

// Rendered as an <a href> on the detail page, so anything but http(s) —
// javascript:, data: — is refused here rather than trusted at render time.
// Machine-set hidden field: an unusable value is dropped, not an error.
function sourceUrlField(formData: FormData): string | null {
  try {
    return httpUrlField(formData, 'image_source_url');
  } catch {
    return null;
  }
}

function httpUrlField(formData: FormData, key: string): string | null {
  const value = textField(formData, key);
  if (value == null) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CoffeeFormError('Product URL must be a valid web address');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CoffeeFormError('Product URL must start with http:// or https://');
  }
  return value;
}

export function parseCoffeeForm(formData: FormData): ValidatedCoffeeInput {
  const roaster = textField(formData, 'roaster');
  const coffeeName = textField(formData, 'coffee_name');
  if (!roaster) throw new CoffeeFormError('Roaster is required');
  if (!coffeeName) throw new CoffeeFormError('Coffee name is required');

  const amountG = numberField(formData, 'amount_g');
  if (amountG != null && amountG < 0) throw new CoffeeFormError('Amount must not be negative');

  const cost = numberField(formData, 'cost');
  if (cost != null && cost < 0) throw new CoffeeFormError('Cost must not be negative');

  const imageUrl = textField(formData, 'image_url');

  let subscriptionId: number | null | undefined;
  if (formData.has('subscription_id')) {
    const raw = textField(formData, 'subscription_id');
    subscriptionId = raw == null ? null : /^[1-9]\d*$/.test(raw) ? Number(raw) : undefined;
    if (subscriptionId === undefined) throw new CoffeeFormError('Pick a subscription from the list');
  }

  return {
    roaster,
    coffee_name: coffeeName,
    origin: textField(formData, 'origin'),
    roast_level: textField(formData, 'roast_level'),
    processing: textField(formData, 'processing'),
    amount_g: amountG,
    cost,
    roast_date: dateField(formData, 'roast_date'),
    frozen_start_date: dateField(formData, 'frozen_start_date'),
    frozen_end_date: dateField(formData, 'frozen_end_date'),
    rest_days_low: numberField(formData, 'rest_days_low'),
    rest_days_high: numberField(formData, 'rest_days_high'),
    image_url: imageUrl,
    product_url: httpUrlField(formData, 'product_url'),
    image_source_url: imageUrl ? sourceUrlField(formData) : null,
    // Unchecked checkboxes aren't submitted at all — presence means checked.
    decaf: formData.get('decaf') != null,
    // Meaningless without an image; the roaster is already required above.
    set_roaster_default: formData.get('set_roaster_default') === '1' && imageUrl != null,
    // Machine-set hidden field: an unusable value is dropped, not an error.
    roaster_website: toOrigin(textField(formData, 'roaster_website')),
    ...(subscriptionId !== undefined && { subscription_id: subscriptionId }),
    // Only the fields the form sent; absent ones stay untouched on update.
    ...Object.fromEntries(COFFEE_ORIGIN_FIELDS.filter((f) => formData.has(f)).map((f) => [f, textField(formData, f)]))
  };
}
