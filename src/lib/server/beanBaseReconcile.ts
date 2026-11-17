import { beanBaseFields, compareField, type BeanBaseBean } from './beanBase';

const FIELDS = ['origin', 'processing', 'region', 'producer', 'variety', 'elevation', 'harvest_time', 'tasting_notes'] as const;
type Field = (typeof FIELDS)[number];
type Row = { field: Field; value: string };

// Per field: site blank + Bean Base value -> fill (no review); Bean Base adds detail around the
// site value -> review; everything else (same, keep) -> no row. Used by the private reconcile script.
export function reconcileBean(
  site: Partial<Record<Field, string | null>>,
  bean: BeanBaseBean,
  ctx: Parameters<typeof beanBaseFields>[1]
): { fill: Row[]; review: (Row & { site: string })[] } {
  const bb = beanBaseFields(bean, ctx) as Record<string, string | undefined>;
  const out: { fill: Row[]; review: (Row & { site: string })[] } = { fill: [], review: [] };
  for (const field of FIELDS) {
    const value = bb[field];
    if (!value) continue;
    const s = site[field] ?? null;
    const c = compareField(s, value);
    if (c === 'fill') out.fill.push({ field, value });
    else if (c === 'review') out.review.push({ field, value, site: s! });
  }
  return out;
}
