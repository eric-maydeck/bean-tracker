// Client-safe: the Stats "Link" picker's option groups. The server supplies
// LinkableCoffee rows (coffees with no Bean Conqueror bean yet).
export interface LinkableCoffee {
  id: number;
  slug: string;
  roaster: string;
  coffee_name: string;
  roast_date: string | null;
  status: string;
  created_at: string;
}

export interface LinkOption {
  id: number;
  label: string;
}

export interface LinkPickerGroup {
  label: string;
  options: LinkOption[];
}

const baseLabel = (c: LinkableCoffee) => `${c.coffee_name} · ${c.roast_date ?? 'no date'} · ${c.status}`;
const norm = (s: string) => s.trim().toLowerCase();

export function linkPickerGroups(
  bean: { roaster: string | null; likelyMatchId: number | null },
  coffees: LinkableCoffee[]
): LinkPickerGroup[] {
  // Twin bags share name, roast date and status: add the added date, then
  // "bag N" (ascending id) if still identical. Computed across ALL coffees.
  const withDate = (c: LinkableCoffee) => `${baseLabel(c)} · added ${c.created_at.slice(0, 10)}`;
  const count = (f: (c: LinkableCoffee) => string) => {
    const m = new Map<string, number>();
    for (const c of coffees) m.set(f(c), (m.get(f(c)) ?? 0) + 1);
    return m;
  };
  const base = count(baseLabel);
  const dated = count(withDate);
  const bagNo = new Map<number, number>();
  const perLabel = new Map<string, number>();
  for (const c of [...coffees].sort((x, y) => x.id - y.id)) {
    const n = (perLabel.get(withDate(c)) ?? 0) + 1;
    perLabel.set(withDate(c), n);
    bagNo.set(c.id, n);
  }
  const option = (c: LinkableCoffee): LinkOption => ({
    id: c.id,
    label:
      base.get(baseLabel(c))! === 1 ? baseLabel(c)
      : dated.get(withDate(c))! === 1 ? withDate(c)
      : `${withDate(c)} · bag ${bagNo.get(c.id)}`
  });
  const roaster = bean.roaster ? norm(bean.roaster) : null;
  const top: LinkOption[] = [];
  const sameRoaster: LinkOption[] = [];
  const other: LinkOption[] = [];
  for (const c of coffees) {
    if (c.id === bean.likelyMatchId) top.push(option(c));
    else if (roaster && norm(c.roaster) === roaster) sameRoaster.push(option(c));
    else other.push(option(c));
  }
  // Every group has a header; empty groups are dropped.
  return [
    { label: 'Top match', options: top },
    { label: 'Same roaster', options: sameRoaster },
    { label: 'Other coffees', options: other }
  ].filter((g) => g.options.length);
}
