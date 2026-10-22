export const GEAR_KINDS = ['dripper', 'grinder', 'filter'] as const;
export type GearKind = (typeof GEAR_KINDS)[number];
export const KIND_LABEL: Record<GearKind, string> = { dripper: 'Dripper', grinder: 'Grinder', filter: 'Filter' };
