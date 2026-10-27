// Pour reading types and wording, shared by the server detector and the pages (no server imports).
export const DETECTOR_VERSION = 2; // bump on any detector change; boot re-reads stale rows
// g/s (calibrated, see fixtures/bcflow/README.md): a pour whose 1 s peak is >= FAST_GPS reads fast.
export const FAST_GPS = 13;
// ...and its average is >= FAST_MIN_AVG_GPS: a slow pour ending in a swirl-like spike peaks high but averages low.
export const FAST_MIN_AVG_GPS = 5;

export interface Pour {
  startS: number;
  durationS: number;
  grams: number;
  avgGps: number;
  peakGps: number;
  speed: 'fast' | 'slow';
  bloom: boolean;
  /** Seconds from this pour's start to the next pour's start (the last runs to totalS). */
  contactS: number;
}
/** afterPour indexes `pours`; -1 = before the first. */
export interface Swirl {
  atS: number;
  afterPour: number;
}
export interface PourReading {
  v: 1;
  pours: Pour[];
  swirls: Swirl[];
  tares: number[];
  bloomCount: number;
  bloomHoldS: number | null;
  immersion: boolean;
  totalS: number;
  drawdownS: number | null;
  scaleWaterG: number;
  ratio: number | null;
  ratioSource: 'logged' | 'scale' | null;
  lowConfidence: boolean;
  pattern: string;
  structureKey: string | null;
}

export function structureKey(bloomCount: number, pattern: string, ratio: number | null): string {
  return `${bloomCount}b-${pattern.toLowerCase()}-${ratio == null ? 'x' : Math.round(ratio)}`;
}

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function describeReading(r: PourReading): string {
  if (!r.pours.length) return 'no pours found';
  const parts: string[] = [];
  const hold = r.bloomHoldS == null ? null : Math.round(r.bloomHoldS / 5) * 5;
  const bloom = hold == null ? 'bloom' : `${hold} s bloom`;
  if (r.bloomCount === 1) parts.push(bloom);
  else if (r.bloomCount === 2) parts.push(`two ${hold == null ? '' : `${hold} s `}blooms`);
  const kinds: { kind: 'fast' | 'slow'; n: number }[] = [];
  for (const p of r.pours.slice(r.bloomCount)) {
    const l = kinds[kinds.length - 1];
    if (l?.kind === p.speed) l.n++;
    else kinds.push({ kind: p.speed, n: 1 });
  }
  const names = { fast: ['fast pour', 'fast pours'], slow: ['slow pour', 'slow pours'] };
  const out = [[...parts, ...kinds.map((k) => plural(k.n, names[k.kind][0], names[k.kind][1]))].join(' + ')];
  if (r.swirls.length > 2) out.push(`${r.swirls.length} swirls`);
  else if (r.swirls.length)
    out.push(
      r.swirls
        .map((w) =>
          w.afterPour < 0
            ? 'swirl before first pour'
            : w.afterPour < r.bloomCount
              ? 'swirl after bloom'
              : `swirl after pour ${w.afterPour + 1}`
        )
        .join(', ')
    );
  out.push(r.ratio == null ? 'ratio unknown' : `~1:${+r.ratio.toFixed(1)}`);
  const s = Math.round(r.totalS);
  out.push(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} total`);
  if (r.immersion) out.push('immersion');
  if (r.lowConfidence) out.push('low confidence');
  return capital(out.join(' · '));
}

export interface Timeline {
  pours: {
    startS: number;
    durationS: number;
    grams: number;
    kind: 'bloom' | 'fast' | 'slow';
  }[];
  swirls: number[];
  totalS: number;
}
export function timelineOf(r: PourReading): Timeline {
  return {
    pours: r.pours.map((p) => ({
      startS: p.startS,
      durationS: p.durationS,
      grams: p.grams,
      kind: p.bloom ? 'bloom' : p.speed
    })),
    swirls: r.swirls.map((w) => w.atS),
    totalS: r.totalS
  };
}
