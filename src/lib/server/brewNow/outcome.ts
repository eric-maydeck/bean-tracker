import type { DatabaseSync } from 'node:sqlite';
import { localDateTime } from '$lib/localDate';
import { bcLocalTime } from '../insights/time';
import { loadBrewRows, type BrewRow } from './load';
import type { Gear, Setting, Suggestion } from './suggest';

const SETTINGS: Setting[] = ['grind', 'temp', 'dose', 'recipe', 'water'];
type Values = Partial<Record<Setting, string | null>>;
export interface MarkView {
  markedLocal: string; status: 'pending' | 'linked' | 'skipped'; gear: Gear;
  diffs: { setting: Setting; suggested: string | null; actual: string | null }[]; rating: number | null; brewId: number | null;
}

// Only the suggested values are kept (no evidence, no notes: they are private).
export function addMark(db: DatabaseSync, m: { coffeeId: number; gear: Gear; suggestion: Suggestion; now: Date }): void {
  const iso = m.now.toISOString();
  const values: Values = Object.fromEntries(m.suggestion.rows.map((r) => [r.setting, r.value]));
  db.prepare(`INSERT INTO brew_now_marks (coffee_id, marked_at, marked_local, grinder, dripper, filter, suggestion) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(m.coffeeId, iso, localDateTime(iso), m.gear.grinder, m.gear.dripper, m.gear.filter, JSON.stringify(values));
}

// Each pending mark takes the earliest unlinked brew of its coffee after it; of several marks before one brew, the latest links
// and the older are skipped. A mark with no later brew stays pending.
export function linkMarks(db: DatabaseSync): number {
  const marks = db.prepare(`SELECT id, coffee_id, marked_local FROM brew_now_marks WHERE status = 'pending' ORDER BY marked_local, id`)
    .all() as unknown as { id: number; coffee_id: number; marked_local: string }[];
  if (!marks.length) return 0;
  const taken = new Set((db.prepare(`SELECT brew_id FROM brew_now_marks WHERE brew_id IS NOT NULL`).all() as unknown as { brew_id: number }[]).map((r) => r.brew_id));
  const brews = loadBrewRows(db).filter((r) => !taken.has(r.id)); // oldest first
  const winner = new Map<number, number>(); // brew id → latest mark id (marks arrive oldest first)
  const skip: number[] = [];
  for (const m of marks) {
    const brew = brews.find((r) => r.coffeeId === m.coffee_id && r.localTime > m.marked_local);
    if (!brew) continue;
    if (winner.has(brew.id)) skip.push(winner.get(brew.id)!);
    winner.set(brew.id, m.id);
  }
  db.exec('BEGIN');
  try {
    for (const [brewId, markId] of winner) db.prepare(`UPDATE brew_now_marks SET status = 'linked', brew_id = ? WHERE id = ?`).run(brewId, markId);
    for (const id of skip) db.prepare(`UPDATE brew_now_marks SET status = 'skipped' WHERE id = ?`).run(id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return winner.size;
}

const num = (n: number | null) => (n === null ? null : String(Math.round(n * 10) / 10));
// The brew's value in the same wording suggest() uses.
const actualOf = (b: BrewRow): Values => ({
  grind: b.grind, temp: b.tempC === null ? null : `${num(b.tempC)} °C`, dose: b.dose === null ? null : `${num(b.dose)} g`,
  recipe: b.recipeName, water: b.water?.trim() || null
});

export function marksFor(db: DatabaseSync, coffeeId: number): MarkView[] {
  const marks = db.prepare(`SELECT marked_local, grinder, dripper, filter, suggestion, brew_id, status FROM brew_now_marks
    WHERE coffee_id = ? ORDER BY marked_local DESC, id DESC LIMIT 5`).all(coffeeId) as unknown as
    { marked_local: string; grinder: string | null; dripper: string | null; filter: string | null; suggestion: string; brew_id: number | null; status: MarkView['status'] }[];
  const linked = marks.some((m) => m.brew_id !== null) ? new Map(loadBrewRows(db).filter((r) => r.coffeeId === coffeeId).map((r) => [r.id, r])) : new Map<number, BrewRow>();
  return marks.map((m) => {
    const brew = m.brew_id === null ? undefined : linked.get(m.brew_id);
    const suggested = JSON.parse(m.suggestion) as Values, actual = brew ? actualOf(brew) : null;
    return {
      markedLocal: m.marked_local, status: m.status, gear: { grinder: m.grinder, dripper: m.dripper, filter: m.filter },
      diffs: actual ? SETTINGS.map((s) => ({ setting: s, suggested: suggested[s] ?? null, actual: actual[s] ?? null }))
        .filter((d) => d.suggested !== d.actual && (d.suggested !== null || d.actual !== null)) : [],
      rating: brew?.rating ?? null, brewId: m.brew_id
    };
  });
}
