import { GEAR_KINDS, type GearKind } from '#lib/gear.ts';

// /gear view state: the kinds shown (absent = all), the kinds whose retired shelf is open, the open trophy card. Explicit choices only.
export interface GearUrlState { gear?: GearKind[]; retired?: GearKind[]; card?: string }

// A comma list of kinds, in GEAR_KINDS order; junk is dropped and nothing valid is undefined. "open" (the old retired value) is every kind.
function kindList(v: string | null, allowOpen = false): GearKind[] | undefined {
  const given = new Set((v ?? '').toLowerCase().split(',').map((x) => x.trim()));
  const picked = allowOpen && given.has('open') ? [...GEAR_KINDS] : GEAR_KINDS.filter((k) => given.has(k));
  return picked.length ? picked : undefined;
}

// The open trophy card on Gear: one "kind-slug" key, lowercased; anything else is dropped.
const CARD = /^(dripper|grinder|filter)-[a-z0-9]+(-[a-z0-9]+)*$/;
export function parseCard(v: string | null): string | undefined {
  const x = (v ?? '').trim().toLowerCase();
  return CARD.test(x) ? x : undefined;
}

export function parseGear(p: URLSearchParams): GearUrlState {
  const gear = kindList(p.get('gear'));
  return { gear: gear?.length === GEAR_KINDS.length ? undefined : gear, retired: kindList(p.get('retired'), true), card: parseCard(p.get('card')) };
}

export function serializeGear(s: GearUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.gear?.length && s.gear.length < GEAR_KINDS.length) p.set('gear', s.gear.join(','));
  if (s.retired?.length) p.set('retired', s.retired.join(','));
  if (s.card) p.set('card', s.card);
  return p;
}

// The old /stats?tab=gear address: its gear/retired/card params move to /gear; null when it isn't one (or carries none).
export function gearRedirect(url: URL): string | null {
  if (url.searchParams.get('tab') !== 'gear') return null;
  const q = serializeGear(parseGear(url.searchParams)).toString();
  return q ? `/gear?${q}` : null;
}

// A trophy's link back to its board on the Stats Gear tab: the dripper and filter boards, the grinder's usage chart by grinder.
export function statsLink(t: { kind: GearKind }): string {
  return t.kind === 'grinder' ? '/stats?tab=gear&gearBy=grinder#gear-eras' : `/stats?tab=gear#gear-${t.kind}s`;
}
