// Client-safe. Image Suggest's reply shapes.
export interface Candidate {
  image: string;
  pageUrl: string;
  pageTitle: string;
  provider: string;
  published: string | null; // page release date, YYYY-MM-DD
  excerpt: string | null; // plain-text description, <=300 chars
  closest: boolean; // the page released nearest the roast date (at most one)
}
export type SuggestStatus = 'ok' | 'empty' | 'failed' | 'unconfigured';
export interface SuggestResult { status: SuggestStatus; site: string | null; candidates: Candidate[]; notes: string[] }
// The endpoint's reply: the result plus the roaster's stored website.
export type SuggestResponse = SuggestResult & { storedSite: string | null };

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const GENERIC = new Set(['the', 'coffee', 'coffees', 'roasters', 'roaster', 'roastery', 'roasting', 'company']);

// Does the host look like this roaster's own site? True when a 3+ letter,
// non-generic word of the name appears in the host, or the whole name does
// (punctuation ignored: "H&S Coffee Roasters" -> hscoffeeroasters.com).
// ponytail: substring heuristic, a stored site or "change" covers misses.
export function hostMatchesRoaster(url: string, roaster: string): boolean {
  const host = hostOf(url).replace(/[^a-z0-9]/g, '');
  const name = roaster.toLowerCase();
  const whole = name.replace(/[^a-z0-9]/g, '');
  if (whole.length >= 3 && host.includes(whole)) return true;
  return name.split(/[^a-z0-9]+/).some((w) => w.length >= 3 && !GENERIC.has(w) && host.includes(w));
}

// A pick: the image; the page as product URL only if there is none yet; the
// page's site as the roaster's website only when none is stored and the host
// looks like the roaster's (user, 2026-10-06: option 1). To fall back to
// option 3 (never save from a pick), return roaster_website: null.
export function pickCandidate(c: Candidate, productUrl: string, storedSite: string | null, roaster: string) {
  return {
    image_url: c.image,
    product_url: productUrl.trim() ? null : c.pageUrl,
    image_source_url: c.pageUrl,
    roaster_website: !storedSite && hostMatchesRoaster(c.pageUrl, roaster) ? new URL(c.pageUrl).origin : null
  };
}
