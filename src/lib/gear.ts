export const GEAR_KINDS = ['dripper', 'filter', 'grinder'] as const;
export type GearKind = (typeof GEAR_KINDS)[number];
export const KIND_LABEL: Record<GearKind, string> = { dripper: 'Dripper', filter: 'Filter', grinder: 'Grinder' };

// Which trophy cards show: a pick rules out the other cards of its own kind only (a dripper pick hides the other
// drippers, grinders and filters stay). The retired shelf holds whichever retired cards survive. Dripper/filter
// picks match a name; the grinder pick is a slug.
export function shownTrophies<T extends { kind: GearKind; key: string; name: string; retired: boolean }>(
  list: readonly T[], pick: { dripper?: string; filter?: string; grinder?: string }
): { active: T[]; retired: T[] } {
  const keep = (t: T) =>
    t.kind === 'dripper' ? !pick.dripper || t.name === pick.dripper
    : t.kind === 'filter' ? !pick.filter || t.name === pick.filter
    : !pick.grinder || t.key === `grinder-${pick.grinder}`;
  const kept = list.filter(keep);
  return { active: kept.filter((t) => !t.retired), retired: kept.filter((t) => t.retired) };
}
