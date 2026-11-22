import { pickOne } from '#lib/pageUrlState.ts';
import { GEAR_KINDS, type GearKind } from '#lib/gear.ts';

// /gear view state: which kind's cards show, the retired shelf, the open trophy card. Explicit choices only.
export interface GearUrlState { gear?: GearKind; retired?: 'open'; card?: string }

// The open trophy card on Gear: one "kind-slug" key, lowercased; anything else is dropped.
const CARD = /^(dripper|grinder|filter)-[a-z0-9]+(-[a-z0-9]+)*$/;
export function parseCard(v: string | null): string | undefined {
  const x = (v ?? '').trim().toLowerCase();
  return CARD.test(x) ? x : undefined;
}

export function parseGear(p: URLSearchParams): GearUrlState {
  return { gear: pickOne(p, 'gear', GEAR_KINDS), retired: pickOne(p, 'retired', ['open']), card: parseCard(p.get('card')) };
}

export function serializeGear(s: GearUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.gear) p.set('gear', s.gear);
  if (s.retired) p.set('retired', s.retired);
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
