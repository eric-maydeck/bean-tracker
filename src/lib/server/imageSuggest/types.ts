// Image Suggest's server-side shapes (spec "Server").
export interface SuggestQuery { roaster: string; name: string; origin: string | null; roastDate: string | null; site: string | null; term?: string }
export interface CandidatePage { url: string; title: string; provider: string }
export type FetchPage = (url: string, signal?: AbortSignal) => Promise<{ status: number; body: string; finalUrl: string }>;
export interface Provider {
  name: string;
  // true: runs. false: silently skipped (no key, no site). A string: skipped, and the string goes in notes.
  available(q: SuggestQuery): boolean | string;
  search(q: SuggestQuery, signal: AbortSignal): Promise<CandidatePage[]>;
}
export type { Candidate, SuggestResult } from '../../imageSuggest';
