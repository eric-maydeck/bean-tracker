import type { RcCol } from '$lib/insightsUrl';
import type { Sample } from '$lib/sample';

export interface RcRow {
  roaster: string; bags: number; spent: number; ppg: number | null; rating: number | null; ratingSample?: Sample;
  like: number | null; likeSample?: Sample; last: string; href: string;
}
export const NATURAL_DIR: Record<RcCol, 'asc' | 'desc'> = { roaster: 'asc', bags: 'desc', spent: 'desc', ppg: 'desc', rating: 'desc', like: 'desc', last: 'desc' };

// Missing values last in both directions; ties: most bags, then name.
export function sortRc(rows: readonly RcRow[], col: RcCol = 'bags', dir: 'asc' | 'desc' = NATURAL_DIR[col]): RcRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[col], y = b[col];
    if ((x === null) !== (y === null)) return x === null ? 1 : -1;
    const c = x === y || x === null || y === null ? 0 : typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number);
    return sign * c || b.bags - a.bags || a.roaster.localeCompare(b.roaster);
  });
}
