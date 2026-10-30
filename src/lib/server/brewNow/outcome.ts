import type { DatabaseSync } from 'node:sqlite';
import { localDateTime } from '$lib/localDate';
import { bcLocalTime } from '../insights/time';
import { loadBrewRows, type BrewRow } from './load';
import { lin, fmtRatio, type Gear, type Setting, type Suggestion } from './suggest';

const SETTINGS: Setting[] = ['grind', 'temp', 'dose', 'ratio', 'recipe', 'water'];
type Values = Partial<Record<Setting, string | null>>;
export interface MarkView {
  id: number; markedLocal: string; status: 'pending' | 'linked' | 'skipped' | 'expired'; gear: Gear;
  diffs: { setting: Setting; suggested: string | null; actual: string | null }[]; rating: number | null; brewId: number | null;
}

// Only the suggested values are kept (no evidence, no notes: they are private).
export function addMark(db: DatabaseSync, m: { coffeeId: number; gear: Gear; suggestion: Suggestion; now: Date }): void {
  const iso = m.now.toISOString();
  const values: Values = Object.fromEntries(m.suggestion.rows.map((r) => [r.setting, r.setting === 'dose' ? (r.value?.split(' · ')[0] ?? null) : r.value])); // dose stored without its water
  db.prepare(`INSERT INTO brew_now_marks (coffee_id, marked_at, marked_local, grinder, dripper, filter, suggestion) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(m.coffeeId, iso, localDateTime(iso), m.gear.grinder, m.gear.dripper, m.gear.filter, JSON.stringify(values));
}

const DAY_MS = 864e5;
// E10: a mark only links a brew made within 24 h after it; one with no such brew by then expires.
const plusDay = (local: string) => new Date(Date.parse(local.slice(0, 16) + ':00Z') + DAY_MS).toISOString().slice(0, 16);

// Admin cancel: only a pending mark can be deleted.
export function deleteMark(db: DatabaseSync, id: number): boolean {
  return db.prepare(`DELETE FROM brew_now_marks WHERE id = ? AND status = 'pending'`).run(id).changes > 0;
}

// Each pending mark takes the earliest unlinked brew of its coffee within 24 h after it; of several marks before one brew, the
// latest links and the older are skipped. A mark with no such brew stays pending for 24 h, then expires.
export function linkMarks(db: DatabaseSync, now = new Date()): number {
  // R11: a linked mark whose brew was deleted (brew_id SET NULL) goes back to pending and re-links to the next eligible brew.
  db.exec(`UPDATE brew_now_marks SET status = 'pending' WHERE status = 'linked' AND brew_id IS NULL`);
  const marks = db.prepare(`SELECT id, coffee_id, marked_local FROM brew_now_marks WHERE status = 'pending' ORDER BY marked_local, id`)
    .all() as unknown as { id: number; coffee_id: number; marked_local: string }[];
  if (!marks.length) return 0;
  const taken = new Set((db.prepare(`SELECT brew_id FROM brew_now_marks WHERE brew_id IS NOT NULL`).all() as unknown as { brew_id: number }[]).map((r) => r.brew_id));
  const brews = loadBrewRows(db).filter((r) => !taken.has(r.id)); // oldest first
  const winner = new Map<number, number>(); // brew id → latest mark id (marks arrive oldest first)
  const skip: number[] = [];
  for (const m of marks) {
    const limit = plusDay(m.marked_local);
    const brew = brews.find((r) => r.coffeeId === m.coffee_id && r.localTime >= m.marked_local && r.localTime.slice(0, 16) <= limit);
    if (!brew) continue;
    if (winner.has(brew.id)) skip.push(winner.get(brew.id)!);
    winner.set(brew.id, m.id);
  }
  db.exec('BEGIN');
  try {
    for (const [brewId, markId] of winner) db.prepare(`UPDATE brew_now_marks SET status = 'linked', brew_id = ? WHERE id = ?`).run(brewId, markId);
    for (const id of skip) db.prepare(`UPDATE brew_now_marks SET status = 'skipped' WHERE id = ?`).run(id);
    db.prepare(`UPDATE brew_now_marks SET status = 'expired' WHERE status = 'pending' AND marked_at < ?`).run(new Date(now.getTime() - DAY_MS).toISOString());
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return winner.size;
}

// The same grind written two ways ("5" / "5.0") is no difference.
const same = (s: Setting, a: string | null, b: string | null) => {
  if (s === 'grind' && lin(b) !== null) { // a suggested range "1.6.0–1.6.5" is followed by any setting inside it
    const [lo, hi] = (a ?? '').split('–').map(lin);
    if (lo != null && hi != null) return lin(b)! >= lo && lin(b)! <= hi;
    if (lo != null) return lo === lin(b);
  }
  return s === 'water' ? (a?.trim() ?? null) === (b?.trim() ?? null) : a === b;
};
const num = (n: number | null) => (n === null ? null : String(Math.round(n * 10) / 10));
// The brew's value in the same wording suggest() uses.
const actualOf = (b: BrewRow): Values => ({
  grind: b.grind, temp: b.tempC === null ? null : `${num(b.tempC)}°C`, dose: b.dose === null ? null : `${num(b.dose)}g`,
  ratio: b.dose && b.waterG ? fmtRatio(b.waterG / b.dose) : null,
  recipe: b.recipeName, water: b.water?.trim() || null
});

export function marksFor(db: DatabaseSync, coffeeId: number): MarkView[] {
  const marks = db.prepare(`SELECT id, marked_local, grinder, dripper, filter, suggestion, brew_id, status FROM brew_now_marks
    WHERE coffee_id = ? ORDER BY marked_local DESC, id DESC LIMIT 5`).all(coffeeId) as unknown as
    { id: number; marked_local: string; grinder: string | null; dripper: string | null; filter: string | null; suggestion: string; brew_id: number | null; status: MarkView['status'] }[];
  const linked = marks.some((m) => m.brew_id !== null) ? new Map(loadBrewRows(db).filter((r) => r.coffeeId === coffeeId).map((r) => [r.id, r])) : new Map<number, BrewRow>();
  return marks.map((m) => {
    const brew = m.brew_id === null ? undefined : linked.get(m.brew_id);
    const suggested = JSON.parse(m.suggestion) as Values, actual = brew ? actualOf(brew) : null;
    return {
      id: m.id, markedLocal: m.marked_local, status: m.status === 'linked' && !brew ? 'pending' : m.status, // R11: brew gone
 gear: { grinder: m.grinder, dripper: m.dripper, filter: m.filter },
      diffs: actual ? SETTINGS.map((s) => ({ setting: s, suggested: suggested[s]?.trim() ?? null, actual: actual[s]?.trim() ?? null }))
        .filter((d) => !same(d.setting, d.suggested, d.actual) && (d.suggested !== null || d.actual !== null)
          && !(d.setting === 'recipe' && brew!.recipeId === null) && !(d.setting === 'ratio' && d.suggested === null)) : [], // the recipe match lands after the pour readings
      rating: brew?.rating ?? null, brewId: m.brew_id
    };
  });
}

// One line over the linked tries: only settings that always went the same way (twice or more).
export function biasLine(marks: MarkView[]): string | null {
  const linked = marks.filter((m) => m.status === 'linked' && m.brewId !== null);
  if (linked.length < 2) return null;
  const deltas = (s: Setting, parse: (v: string) => number | null) => linked.flatMap((m) => {
    const d = m.diffs.find((x) => x.setting === s);
    if (!d) return [0];
    const a = d.suggested === null ? null : parse(d.suggested), b = d.actual === null ? null : parse(d.actual);
    return a === null || b === null ? [] : [b - a];
  });
  const parts: string[] = [];
  const consistent = (xs: number[]) => xs.filter((x) => x !== 0).length >= 2 && (xs.every((x) => x >= 0) || xs.every((x) => x <= 0));
  const g = deltas('grind', lin);
  if (consistent(g)) parts.push(`${g[g.findIndex((x) => x !== 0)] > 0 ? 'higher' : 'lower'} grind setting than suggested ${g.filter((x) => x !== 0).length}\u00d7`);
  const t = deltas('temp', (v) => parseFloat(v) || null);
  if (consistent(t)) { const avg = Math.round(t.reduce((a, b) => a + b, 0) / t.length * 10) / 10; parts.push(`temp ${avg > 0 ? '+' : ''}${avg} \u00b0C on average`); }
  return parts.length ? `Last ${linked.length} tries: ${parts.join(', ')}` : null;
}
