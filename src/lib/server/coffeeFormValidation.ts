export interface ValidatedCoffeeInput {
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
  decaf: boolean;
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

export function parseCoffeeForm(formData: FormData): ValidatedCoffeeInput {
  const roaster = textField(formData, 'roaster');
  const coffeeName = textField(formData, 'coffee_name');
  if (!roaster) throw new CoffeeFormError('Roaster is required');
  if (!coffeeName) throw new CoffeeFormError('Coffee name is required');

  const amountG = numberField(formData, 'amount_g');
  if (amountG != null && amountG < 0) throw new CoffeeFormError('Amount must not be negative');

  const cost = numberField(formData, 'cost');
  if (cost != null && cost < 0) throw new CoffeeFormError('Cost must not be negative');

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
    image_url: textField(formData, 'image_url'),
    // Unchecked checkboxes aren't submitted at all — presence means checked.
    decaf: formData.get('decaf') != null
  };
}
