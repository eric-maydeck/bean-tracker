// Orders a page's images by how likely each is the bag art
// (docs/image-suggest-criteria.md). Pure; uses only what the page states.
import { hostOf } from '$lib/imageSuggest';
import type { PageImage } from './pageImages';
import type { Candidate, CandidatePage } from './types';

const BAG = /mock|bag|label|pouch/;
const LIFESTYLE = /beans|cup|brew|farm/;

function fileName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '').toLowerCase();
  } catch {
    return '';
  }
}

// ponytail: fixed weights and substring hints ("cabbage" counts as a bag);
// tune from the comparison run (Task 12) if the order looks wrong.
export function scoreImage(img: PageImage, roastYear: string | null): number {
  const file = fileName(img.url);
  const text = `${file} ${img.alt.toLowerCase()}`;
  let score = 0;
  if (BAG.test(text)) score += 3;
  if (LIFESTYLE.test(text)) score -= 2;
  const years = [...file.matchAll(/(?<!\d)(20\d\d)(?!\d)/g)].map((m) => m[1]);
  if (roastYear && years.includes(roastYear)) score += 2;
  else if (roastYear && years.length) score -= 2;
  if (img.width && img.height && Math.max(img.width, img.height) / Math.min(img.width, img.height) > 2) score -= 2;
  return score;
}

export function rankImages(
  pages: { page: CandidatePage; images: PageImage[] }[],
  roastDate: string | null,
  site: string | null
): Candidate[] {
  const roastYear = roastDate?.slice(0, 4) ?? null;
  const siteHost = site ? hostOf(site) : null;
  const scored = pages.flatMap(({ page, images }, p) =>
    images.map((img, i) => ({
      c: { image: img.url, pageUrl: page.url, pageTitle: page.title, provider: page.provider },
      own: siteHost !== null && hostOf(page.url) === siteHost ? 1 : 0,
      score: scoreImage(img, roastYear),
      p,
      i
    }))
  );
  scored.sort((a, b) => b.own - a.own || b.score - a.score || a.p - b.p || a.i - b.i);
  const seen = new Set<string>();
  return scored.filter(({ c }) => !seen.has(c.image) && seen.add(c.image)).map(({ c }) => c);
}
