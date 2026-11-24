import type { DatabaseSync } from 'node:sqlite';
import { isCatalogFilter } from '#lib/filterCatalog.ts';
import { parseMethod, MIXED_FILTER } from './insights/facts';

export type ToolKind = 'filter' | 'accessory';
export interface BrewGear { dripper: string | null; filter: string | null; filters: string[]; accessories: string[] }

// Select columns for a brew's ticked tool names and its method's tool names (char(31)-joined). One fragment for every reader.
export const toolColumns = (brew = 'b', method = 'm') =>
  `(SELECT group_concat(t.name, char(31)) FROM beanconqueror_brew_tools bt JOIN beanconqueror_method_tools t ON t.uuid = bt.tool_uuid WHERE bt.brew_uuid = ${brew}.bc_uuid) AS ticked,
   (SELECT group_concat(t.name, char(31)) FROM beanconqueror_method_tools t WHERE t.method_id = ${method}.id) AS mtools`;

const stripName = (n: string) => n.replace(/ filters$/i, '').trim();
export const splitTools = (s: string | null): string[] => (s ?? '').split('\x1f').map(stripName).filter(Boolean);

// Kind of every tool name ticked on a brew or saved in tool_kinds (spec section 5, step 1).
export function loadToolKinds(db: DatabaseSync): Map<string, ToolKind> {
  const byBrew = new Map<string, string[]>();
  for (const r of db.prepare(`SELECT bt.brew_uuid AS brew, t.name FROM beanconqueror_brew_tools bt JOIN beanconqueror_method_tools t ON t.uuid = bt.tool_uuid`).all() as { brew: string; name: string }[])
    byBrew.set(r.brew, [...(byBrew.get(r.brew) ?? []), stripName(r.name)]);
  const kinds = new Map<string, ToolKind>();
  for (const names of byBrew.values()) {
    const beside = names.some(isCatalogFilter);
    for (const n of names) if (!isCatalogFilter(n) && beside) kinds.set(n, 'accessory');
  }
  for (const names of byBrew.values()) for (const n of names) if (!kinds.has(n)) kinds.set(n, 'filter');
  for (const r of db.prepare(`SELECT name, kind FROM tool_kinds`).all() as { name: string; kind: string }[]) kinds.set(r.name, r.kind === 'accessory' ? 'accessory' : 'filter');
  return kinds;
}

const isFilter = (kinds: Map<string, ToolKind>, n: string) => kinds.get(n) !== 'accessory';

export function readGear(method: string | null, methodTools: string[], ticked: string[], kinds: Map<string, ToolKind>, legacyTools: string | null): BrewGear {
  const pick = (dripper: string | null, fs: string[], accessories: string[]): BrewGear => ({ dripper, filter: fs.length === 1 ? fs[0] : null, filters: fs, accessories });
  if (!method) return pick(null, [], []);
  if (ticked.length) return pick(method.trim(), ticked.filter((n) => isFilter(kinds, n)), ticked.filter((n) => !isFilter(kinds, n)));
  const old = parseMethod(method, legacyTools);
  if (old.filter === MIXED_FILTER) return { ...old, filters: [MIXED_FILTER], accessories: [] };
  if (methodTools.length >= 2) return pick(method.trim(), methodTools.filter((n) => isFilter(kinds, n)), []);
  if (old.filter && !isFilter(kinds, old.filter)) return pick(old.dripper, [], [old.filter]);
  return pick(old.dripper, old.filter ? [old.filter] : [], []);
}

// The shared reader step: a query row that selected toolColumns() plus method/tools -> its gear.
export const gearOfRow = (r: { method: string | null; tools: string | null; ticked: string | null; mtools: string | null }, kinds: Map<string, ToolKind>) =>
  readGear(r.method, splitTools(r.mtools), splitTools(r.ticked), kinds, r.tools);
