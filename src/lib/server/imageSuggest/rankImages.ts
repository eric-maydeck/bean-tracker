// Orders a page's images by how likely each is the bag art
// (docs/image-suggest-criteria.md). Pure; uses only what the page states.
import { hostOf } from '$lib/imageSuggest';
import type { PageDetails, PageImage } from './pageImages';
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
  pages: { page: CandidatePage; images: PageImage[]; details?: PageDetails }[],
  roastDate: string | null,
  site: string | null
): Candidate[] {
  const roastYear = roastDate?.slice(0, 4) ?? null;
  const siteHost = site ? hostOf(site) : null;
  const roastMs = roastDate ? Date.parse(roastDate) : NaN;
  const scored = pages.flatMap(({ page, images, details }, p) => {
    const published = details?.published ?? null;
    const days = published && !Number.isNaN(roastMs) ? Math.abs(Date.parse(published) - roastMs) : Infinity;
    return images.map((img, i) => ({
      c: {
        image: img.url,
        pageUrl: page.url,
        pageTitle: page.title,
        provider: page.provider,
        published,
        excerpt: details?.excerpt ?? null,
        closest: false
      },
      days,
      own: siteHost !== null && hostOf(page.url) === siteHost ? 1 : 0,
      score: scoreImage(img, roastYear),
      p,
      i
    }));
  });
  // Page release nearest the roast date first (undated / no roast date last), then own site, score, position.
  scored.sort((a, b) => (a.days === b.days ? 0 : a.days < b.days ? -1 : 1) || b.own - a.own || b.score - a.score || a.p - b.p || a.i - b.i);
  const seen = new Set<string>();
  const out = scored.filter(({ c }) => !seen.has(c.image) && seen.add(c.image));
  if (out.length && out[0].days !== Infinity) out[0].c.closest = true;
  return out.map(({ c }) => c);
}
