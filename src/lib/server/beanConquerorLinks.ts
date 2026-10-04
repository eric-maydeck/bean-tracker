// Bean Conqueror bean ↔ coffee links: one bean per coffee, one coffee per bean
// (unique index beanconqueror_beans_coffee). db.ts imports this file, so value
// imports here must use explicit .ts extensions (node scripts load db.ts).
import type { DatabaseSync } from 'node:sqlite';

// The old "tracked" test. Now it only drives the backfill, auto-link and suggestions.
const EXACT_MATCH = `c.roaster = b.roaster AND c.coffee_name = b.name AND c.roast_date = b.roast_date`;
const COFFEE_HAS_BEAN = `EXISTS (SELECT 1 FROM beanconqueror_beans x WHERE x.coffee_id = c.id)`;

// One time, when the column is added: link each bean whose exact match is
// unambiguous (exactly one coffee has its roaster + name + roast date, and no
// other bean shares that key). Duplicate bags stay unlinked for reconciliation.
export function backfillBeanConquerorLinks(db: DatabaseSync): void {
  db.exec(`
    UPDATE beanconqueror_beans AS b
    SET coffee_id = (SELECT c.id FROM coffees c WHERE ${EXACT_MATCH})
    WHERE (SELECT COUNT(*) FROM coffees c WHERE ${EXACT_MATCH}) = 1
      AND (SELECT COUNT(*) FROM beanconqueror_beans b2
           WHERE b2.roaster = b.roaster AND b2.name = b.name AND b2.roast_date = b.roast_date) = 1`);
}

// After each import, for the beans that are new in it only (existing beans are
// never auto-linked, so a manual Unlink sticks). The same "unambiguous both
// ways" rule as the backfill: exactly one unlinked coffee matches the bean,
// and that coffee is matched by exactly one of this import's candidates.
// (Not shared with the backfill's SQL: that one counts every bean, this one
// only the new, unlinked ones.)
export function autoLinkBeanConquerorBeans(db: DatabaseSync, newBeanIds: readonly string[]): number {
  const matchesOf = db.prepare(
    `SELECT c.id FROM beanconqueror_beans b JOIN coffees c ON ${EXACT_MATCH}
     WHERE b.id = ? AND b.coffee_id IS NULL AND b.dismissed_at IS NULL AND NOT ${COFFEE_HAS_BEAN}`
  );
  const byBean = new Map<string, number[]>();
  for (const id of newBeanIds) byBean.set(id, (matchesOf.all(id) as { id: number }[]).map((r) => r.id));
  const beansPerCoffee = new Map<number, number>();
  for (const ids of byBean.values()) for (const c of ids) beansPerCoffee.set(c, (beansPerCoffee.get(c) ?? 0) + 1);
  const link = db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`);
  let linked = 0;
  for (const [beanId, ids] of byBean) {
    if (ids.length === 1 && beansPerCoffee.get(ids[0]) === 1) {
      link.run(ids[0], beanId);
      linked++;
    }
  }
  return linked;
}
