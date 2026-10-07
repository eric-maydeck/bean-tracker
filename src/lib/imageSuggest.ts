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
