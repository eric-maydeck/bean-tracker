// One-off (#184): after a converted BQ export is re-imported, rename the gear names stored on the site.
// node scripts/fixes/2026-11-24-rename-gear.ts <map.json> <db path>...
// map.json: { drippers: {old: new}, filters: {old: new}, deleteCards: [{kind, name}], deleteMethods: [name] }
// Name-storing columns covered: gear_details (kind + name), locked_drippers, recipes.definition (drippers),
// tool_kinds.name (filters), brew_now_marks.dripper / filter, plus the delete lists. Not covered: short_links
// (URLs that embed old names; they expire) and the BQ tables (the re-import brings the new names).
// Every statement matches the old value, so a rerun changes nothing. Each map is applied in one pass per name:
// don't chain renames (A -> B plus B -> C).
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export interface RenameMap {
  drippers: Record<string, string>;
  filters: Record<string, string>;
  deleteCards: { kind: string; name: string }[];
  deleteMethods: string[];
}

export function renameGear(db: DatabaseSync, map: RenameMap): string[] {
  const out: string[] = [];
  const run = (sql: string, ...a: string[]) => Number(db.prepare(sql).run(...a).changes);
  const has = (sql: string, ...a: string[]) => !!db.prepare(sql).get(...a);
  db.exec('BEGIN');
  try {
    for (const [kind, names] of [['dripper', map.drippers], ['filter', map.filters]] as const) {
      for (const [from, to] of Object.entries(names)) {
        if (from === to) continue;
        // A card: rename unless the new name already has one (then report and leave the old one).
        if (has(`SELECT 1 FROM gear_details WHERE kind = ? AND name = ?`, kind, from)) {
          if (has(`SELECT 1 FROM gear_details WHERE kind = ? AND name = ?`, kind, to)) out.push(`skipped ${kind} card ${from}: ${to} already has one`);
          else { run(`UPDATE gear_details SET name = ? WHERE kind = ? AND name = ?`, to, kind, from); out.push(`${kind} card ${from} -> ${to}`); }
        }
        if (kind === 'dripper') {
          if (has(`SELECT 1 FROM locked_drippers WHERE name = ?`, to)) run(`DELETE FROM locked_drippers WHERE name = ?`, from);
          else if (run(`UPDATE locked_drippers SET name = ? WHERE name = ?`, to, from)) out.push(`locked dripper ${from} -> ${to}`);
          if (run(`UPDATE brew_now_marks SET dripper = ? WHERE dripper = ?`, to, from)) out.push(`brew-now marks dripper ${from} -> ${to}`);
        } else {
          if (has(`SELECT 1 FROM tool_kinds WHERE name = ?`, to)) run(`DELETE FROM tool_kinds WHERE name = ?`, from);
          else if (run(`UPDATE tool_kinds SET name = ? WHERE name = ?`, to, from)) out.push(`tool kind ${from} -> ${to}`);
          if (run(`UPDATE brew_now_marks SET filter = ? WHERE filter = ?`, to, from)) out.push(`brew-now marks filter ${from} -> ${to}`);
        }
      }
    }
    for (const r of db.prepare(`SELECT id, definition FROM recipes`).all() as { id: number; definition: string }[]) {
      const def = JSON.parse(r.definition) as { drippers?: string[] };
      const next = [...new Set((def.drippers ?? []).map((n) => map.drippers[n] ?? n))];
      if (!def.drippers || next.join('\0') === def.drippers.join('\0')) continue;
      run(`UPDATE recipes SET definition = ? WHERE id = ?`, JSON.stringify({ ...def, drippers: next }), String(r.id));
      out.push(`recipe ${r.id} drippers -> ${next.join(', ')}`);
    }
    for (const c of map.deleteCards) if (run(`DELETE FROM gear_details WHERE kind = ? AND name = ?`, c.kind, c.name)) out.push(`deleted ${c.kind} card ${c.name}`);
    for (const name of map.deleteMethods)
      for (const m of db.prepare(`SELECT id FROM beanconqueror_methods WHERE name = ?`).all(name) as { id: string }[]) {
        if (has(`SELECT 1 FROM beanconqueror_brews WHERE preparation_id = ?`, m.id)) { out.push(`kept method ${name}: a brew uses it`); continue; }
        run(`DELETE FROM beanconqueror_method_tools WHERE method_id = ?`, m.id);
        run(`DELETE FROM beanconqueror_methods WHERE id = ?`, m.id);
        out.push(`deleted method ${name}`);
      }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return out;
}

if (process.argv[1]?.endsWith('2026-11-24-rename-gear.ts')) {
  const [mapPath, ...dbs] = process.argv.slice(2);
  if (!mapPath || !dbs.length) {
    console.error('usage: 2026-11-24-rename-gear.ts <map.json> <db path>...');
    process.exit(1);
  }
  const missing = [mapPath, ...dbs].filter((p) => !existsSync(p));
  if (missing.length) {
    console.error(`not found: ${missing.join(', ')}`);
    process.exit(1);
  }
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as RenameMap;
  for (const p of dbs) {
    const db = new DatabaseSync(p);
    console.log(`${p}:`);
    for (const l of renameGear(db, map)) console.log(`  ${l}`);
    db.close();
  }
}
