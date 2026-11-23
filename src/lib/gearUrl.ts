import { GEAR_KINDS, type GearKind } from '#lib/gear.ts';

// /gear view state: the kinds whose retired shelf is open, the open trophy card. Explicit choices only.
export interface GearUrlState { retired?: GearKind[]; card?: string }

// A comma list of kinds, in GEAR_KINDS order; junk is dropped and nothing valid is undefined. "open" (the old value) is every kind.
function kindList(v: string | null): GearKind[] | undefined {
  const given = new Set((v ?? '').toLowerCase().split(',').map((x) => x.trim()));
  const picked = given.has('open') ? [...GEAR_KINDS] : GEAR_KINDS.filter((k) => given.has(k));
  return picked.length ? picked : undefined;
}

// The open trophy card on Gear: one "kind-slug" key, lowercased; anything else is dropped.
const CARD = /^(dripper|grinder|filter)-[a-z0-9]+(-[a-z0-9]+)*$/;
export function parseCard(v: string | null): string | undefined {
  const x = (v ?? '').trim().toLowerCase();
  return CARD.test(x) ? x : undefined;
}

export function parseGear(p: URLSearchParams): GearUrlState {
  return { retired: kindList(p.get('retired')), card: parseCard(p.get('card')) };
}

export function serializeGear(s: GearUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.retired?.length) p.set('retired', s.retired.join(','));
  if (s.card) p.set('card', s.card);
  return p;
}

// The old /stats?tab=gear address: its retired/card params (and the retired `gear` kind filter, dropped) move to /gear; null when it carries none.
export function gearRedirect(url: URL): string | null {
  const p = url.searchParams;
  if (p.get('tab') !== 'gear' || !['gear', 'retired', 'card'].some((k) => p.has(k))) return null;
  const q = serializeGear(parseGear(p)).toString();
  return q ? `/gear?${q}` : '/gear';
}

// A trophy's link to its stats: dripper and filter filter the Overview by name; a grinder opens Sweet Spots on its slug (the key minus "grinder-").
// Every kind getting a real Stats filter is #177.
export function statsLink(t: { kind: GearKind; key: string; name: string }): string {
  return t.kind === 'grinder'
    ? `/stats?${new URLSearchParams({ tab: 'sweetspots', grinder: t.key.replace(/^grinder-/, '') })}`
    : `/stats?${new URLSearchParams({ [t.kind]: t.name })}`;
}
