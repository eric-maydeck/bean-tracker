// Orders a page's images by how likely each is the bag art
// (docs/image-suggest-criteria.md). Pure; uses only what the page states.
import { hostOf } from '$lib/imageSuggest';
import type { PageDetails, PageImage } from './pageImages';
import type { Candidate, CandidatePage } from './types';

const BAG = /mock|bag|label|pouch/;
const LIFESTYLE = /beans|cup|brew|farm|logo|brand/;

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

const words = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

export function rankImages(
  pages: { page: CandidatePage; images: PageImage[]; details?: PageDetails }[],
  roastDate: string | null,
  site: string | null,
  name = ''
): Candidate[] {
  const nameWords = [...new Set(words(name))];
  const roastYear = roastDate?.slice(0, 4) ?? null;
  const siteHost = site ? hostOf(site) : null;
  const roastMs = roastDate ? Date.parse(roastDate) : NaN;
  const titleMatch = (title: string) => {
    const t = new Set(words(title));
    return nameWords.filter((w) => t.has(w)).length;
  };
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
      match: titleMatch(page.title),
      own: siteHost !== null && hostOf(page.url) === siteHost ? 1 : 0,
      score: scoreImage(img, roastYear),
      p,
      i
    }));
  });
  // Coffee-name match first, then page release nearest the roast date (undated / no roast date last), own site, score, position.
  scored.sort((a, b) => b.match - a.match || (a.days === b.days ? 0 : a.days < b.days ? -1 : 1) || b.own - a.own || b.score - a.score || a.p - b.p || a.i - b.i);
  const seen = new Set<string>();
  const out = scored.filter(({ c }) => !seen.has(c.image) && seen.add(c.image));
  if (out.length && out[0].days !== Infinity) out[0].c.closest = true;
  return out.map(({ c }) => c);
}
