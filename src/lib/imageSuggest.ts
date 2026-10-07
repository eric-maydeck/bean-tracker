// Client-safe. Image Suggest's reply shapes (spec 2026-10-06-image-suggest-design.md).
export interface Candidate { image: string; pageUrl: string; pageTitle: string; provider: string }
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
// non-generic word of the name appears in the host (punctuation ignored).
// ponytail: substring heuristic, a stored site or "change" covers misses.
function hostMatchesRoaster(url: string, roaster: string): boolean {
  const host = hostOf(url).replace(/[^a-z0-9]/g, '');
  return roaster
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((w) => w.length >= 3 && !GENERIC.has(w) && host.includes(w));
}

// A pick: the image; the page as product URL only if there is none yet; the
// page's site as the roaster's website only when none is stored and the host
// looks like the roaster's (user, 2026-10-06: option 1). To fall back to
// option 3 (never save from a pick), return roaster_website: null.
export function pickCandidate(c: Candidate, productUrl: string, storedSite: string | null, roaster: string) {
  return {
    image_url: c.image,
    product_url: productUrl.trim() ? null : c.pageUrl,
    roaster_website: !storedSite && hostMatchesRoaster(c.pageUrl, roaster) ? new URL(c.pageUrl).origin : null
  };
}
