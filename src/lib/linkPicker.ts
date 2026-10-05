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
  label: string; // the whole line: roaster · name · meta
  roaster: string;
  name: string;
  meta: string; // roast date · status (· added … for twins)
  bag?: string; // "Bag N" for same-day twins, shown on its own line
  search: string; // lowercase label, for filterLinkGroups
}

export interface LinkPickerGroup {
  label: string;
  top?: true; // the Top match group; its first option is preselected
  options: LinkOption[];
}

const baseLabel = (c: LinkableCoffee) =>
  [c.roaster?.trim(), c.coffee_name, c.roast_date ?? 'no date', c.status].filter(Boolean).join(' · ');
const norm = (s: string) => s.trim().toLowerCase();

export function linkPickerGroups(
  bean: { roaster: string | null; likelyMatchId: number | null },
  coffees: LinkableCoffee[]
): LinkPickerGroup[] {
  // Twin bags share name, roast date and status: add the added date, then
  // "Bag N" (ascending id) if still identical. Computed across ALL coffees.
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
  const option = (c: LinkableCoffee): LinkOption => {
    const added = base.get(baseLabel(c))! === 1 ? '' : ` · added ${c.created_at.slice(0, 10)}`;
    const bag = added && dated.get(withDate(c))! > 1 ? `Bag ${bagNo.get(c.id)}` : undefined;
    const label = baseLabel(c) + added + (bag ? ` · ${bag}` : '');
    return {
      id: c.id,
      label,
      roaster: c.roaster?.trim() ?? '',
      name: c.coffee_name,
      meta: `${c.roast_date ?? 'no date'} · ${c.status}${added}`,
      ...(bag && { bag }),
      search: label.toLowerCase()
    };
  };
  const roaster = bean.roaster ? norm(bean.roaster) : null;
  const top: LinkOption[] = [];
  const sameRoaster: LinkOption[] = [];
  const other: LinkOption[] = [];
  const likely = coffees.find((c) => c.id === bean.likelyMatchId);
  const isTwin = (c: LinkableCoffee) =>
    !!likely?.roast_date && c.roaster === likely.roaster && c.coffee_name === likely.coffee_name &&
    c.roast_date === likely.roast_date;
  // Top match first, then its twins by ascending id.
  if (likely) top.push(option(likely));
  top.push(
    ...coffees.filter((c) => c !== likely && isTwin(c)).sort((x, y) => x.id - y.id).map(option)
  );
  for (const c of coffees) {
    if (c === likely || isTwin(c)) continue;
    else if (roaster && norm(c.roaster) === roaster) sameRoaster.push(option(c));
    else other.push(option(c));
  }
  // Every group has a header; empty groups are dropped.
  return [
    { label: 'Top match', top: true as const, options: top },
    { label: 'Same roaster', options: sameRoaster },
    { label: 'Other coffees', options: other }
  ].filter((g) => g.options.length);
}

// Case-insensitive substring filter over each option's precomputed search
// string; groups left empty are dropped.
export function filterLinkGroups(groups: LinkPickerGroup[], query: string): LinkPickerGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({ ...g, options: g.options.filter((o) => o.search.includes(q)) }))
    .filter((g) => g.options.length);
}
