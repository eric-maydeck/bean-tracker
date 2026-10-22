export const GEAR_KINDS = ['dripper', 'grinder', 'filter'] as const;
export type GearKind = (typeof GEAR_KINDS)[number];
export const KIND_LABEL: Record<GearKind, string> = { dripper: 'Dripper', grinder: 'Grinder', filter: 'Filter' };

// Which trophy cards show: no pick = the active ones plus the retired shelf; any pick = exactly the picked
// cards (retired included), no shelf. Dripper/filter picks match a name; the grinder pick is a slug.
export function shownTrophies<T extends { kind: GearKind; key: string; name: string; retired: boolean }>(
  list: readonly T[], pick: { dripper?: string; filter?: string; grinder?: string }
): { active: T[]; retired: T[] } {
  if (!pick.dripper && !pick.filter && !pick.grinder) return { active: list.filter((t) => !t.retired), retired: list.filter((t) => t.retired) };
  const hit = (t: T) =>
    (t.kind === 'dripper' && t.name === pick.dripper) || (t.kind === 'filter' && t.name === pick.filter) ||
    (!!pick.grinder && t.key === `grinder-${pick.grinder}`);
  return { active: list.filter(hit), retired: [] };
}
