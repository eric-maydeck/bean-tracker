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

export interface LinkPickerGroups {
  likely: LinkOption | null;
  sameRoaster: LinkOption[];
  other: LinkOption[];
}

const baseLabel = (c: LinkableCoffee) => `${c.coffee_name} · ${c.roast_date ?? 'no date'} · ${c.status}`;
const norm = (s: string) => s.trim().toLowerCase();

export function linkPickerGroups(
  bean: { roaster: string | null; likelyMatchId: number | null },
  coffees: LinkableCoffee[]
): LinkPickerGroups {
  // Twin bags share name, roast date and status; the added date tells them apart.
  const seen = new Map<string, number>();
  for (const c of coffees) seen.set(baseLabel(c), (seen.get(baseLabel(c)) ?? 0) + 1);
  const option = (c: LinkableCoffee): LinkOption => ({
    id: c.id,
    label: seen.get(baseLabel(c))! > 1 ? `${baseLabel(c)} · added ${c.created_at.slice(0, 10)}` : baseLabel(c)
  });
  const roaster = bean.roaster ? norm(bean.roaster) : null;
  const groups: LinkPickerGroups = { likely: null, sameRoaster: [], other: [] };
  for (const c of coffees) {
    if (c.id === bean.likelyMatchId) groups.likely = option(c);
    else if (roaster && norm(c.roaster) === roaster) groups.sameRoaster.push(option(c));
    else groups.other.push(option(c));
  }
  return groups;
}
