// Bean Conqueror bean ↔ coffee links: one bean per coffee, one coffee per bean
// (unique index beanconqueror_beans_coffee). db.ts imports this file, so value
// imports here must use explicit .ts extensions (node scripts load db.ts).
import type { DatabaseSync } from 'node:sqlite';
import type { LinkableCoffee } from '../linkPicker';

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
// and that coffee is matched by exactly one of this import's candidates. A new
// bean is also skipped when an existing unlinked, non-dismissed bean has the
// same key (a duplicate bag: which one the coffee is, is for the user to say).
// (Not shared with the backfill's SQL: that one counts every bean, this one
// only the new, unlinked ones.)
export function autoLinkBeanConquerorBeans(db: DatabaseSync, newBeanIds: readonly string[]): number {
  const matchesOf = db.prepare(
    `SELECT c.id FROM beanconqueror_beans b JOIN coffees c ON ${EXACT_MATCH}
     WHERE b.id = ? AND b.coffee_id IS NULL AND b.dismissed_at IS NULL AND NOT ${COFFEE_HAS_BEAN}
       AND NOT EXISTS (SELECT 1 FROM beanconqueror_beans x
         WHERE x.roaster = b.roaster AND x.name = b.name AND x.roast_date = b.roast_date
           AND x.coffee_id IS NULL AND x.dismissed_at IS NULL
           AND x.id NOT IN (SELECT value FROM json_each(?)))`
  );
  const newIds = JSON.stringify(newBeanIds);
  const byBean = new Map<string, number[]>();
  for (const id of newBeanIds) byBean.set(id, (matchesOf.all(id, newIds) as { id: number }[]).map((r) => r.id));
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

// Message is shown to the user as-is.
export class BeanLinkError extends Error {}

export function linkBeanConquerorBean(db: DatabaseSync, beanId: string, coffeeId: number): void {
  const bean = db.prepare(`SELECT coffee_id FROM beanconqueror_beans WHERE id = ?`).get(beanId) as
    | { coffee_id: number | null }
    | undefined;
  if (!bean) throw new BeanLinkError('That Bean Conqueror bean no longer exists');
  if (bean.coffee_id === coffeeId) return;
  if (bean.coffee_id !== null) throw new BeanLinkError('That bean is already linked to another coffee');
  const coffee = db.prepare(`SELECT coffee_name FROM coffees WHERE id = ?`).get(coffeeId) as
    | { coffee_name: string }
    | undefined;
  if (!coffee) throw new BeanLinkError('That coffee no longer exists');
  if (db.prepare(`SELECT 1 FROM beanconqueror_beans WHERE coffee_id = ?`).get(coffeeId)) {
    throw new BeanLinkError(`${coffee.coffee_name} is already linked to a Bean Conqueror bean`);
  }
  db.prepare(`UPDATE beanconqueror_beans SET coffee_id = ? WHERE id = ?`).run(coffeeId, beanId);
}

// Unlink means "back to Not yet tracked", so a dismissal is cleared too.
export function unlinkBeanConquerorBean(db: DatabaseSync, coffeeId: number): boolean {
  const { changes } = db
    .prepare(`UPDATE beanconqueror_beans SET coffee_id = NULL, dismissed_at = NULL WHERE coffee_id = ?`)
    .run(coffeeId);
  return Number(changes) > 0;
}

export function getLinkedBean(db: DatabaseSync, coffeeId: number): { id: string; name: string; brewCount: number } | null {
  const row = db
    .prepare(
      `SELECT b.id, b.name, (SELECT COUNT(*) FROM beanconqueror_brews r WHERE r.bean_id = b.id) AS brew_count
       FROM beanconqueror_beans b WHERE b.coffee_id = ?`
    )
    .get(coffeeId) as { id: string; name: string; brew_count: number } | undefined;
  return row ? { id: row.id, name: row.name, brewCount: row.brew_count } : null;
}

export function getLinkableCoffees(db: DatabaseSync): LinkableCoffee[] {
  return db
    .prepare(
      `SELECT c.id, c.slug, c.roaster, c.coffee_name, c.roast_date, c.status, c.created_at FROM coffees c
       WHERE NOT ${COFFEE_HAS_BEAN}
       ORDER BY c.roaster COLLATE NOCASE, c.coffee_name COLLATE NOCASE, c.roast_date, c.created_at`
    )
    .all() as unknown as LinkableCoffee[];
}
