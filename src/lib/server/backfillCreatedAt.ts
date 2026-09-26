import { findLikelyMatch, type LikelyMatchCandidate } from './beanconqueror';

export interface BackfillBean {
  name: string;
  roaster: string | null;
  roast_date: string | null;
  bc_created_at: string | null;
}

export type BackfillSource = 'exact' | 'fuzzy' | 'roast';

// A sheet-imported coffee's real created_at: the earliest Bean Conqueror
// bc_created_at among exactly matching beans (same rule as
// UNMATCHED_BEAN_WHERE), else among likely (fuzzy) matches, else its roast
// date, else null (leave it alone).
export function pickCreatedAt(
  coffee: LikelyMatchCandidate,
  beans: BackfillBean[]
): { createdAt: string; source: BackfillSource } | null {
  const earliest = (matches: BackfillBean[]) =>
    matches
      .map((b) => b.bc_created_at)
      .filter((d): d is string => d != null)
      .sort()[0];
  const exact = earliest(
    beans.filter((b) => b.roaster === coffee.roaster && b.name === coffee.coffee_name && b.roast_date === coffee.roast_date)
  );
  if (exact) return { createdAt: exact, source: 'exact' };
  const fuzzy = earliest(
    beans.filter((b) => findLikelyMatch({ name: b.name, roaster: b.roaster, roastDate: b.roast_date }, [coffee]) === coffee)
  );
  if (fuzzy) return { createdAt: fuzzy, source: 'fuzzy' };
  if (coffee.roast_date) return { createdAt: `${coffee.roast_date}T00:00:00.000Z`, source: 'roast' };
  return null;
}
