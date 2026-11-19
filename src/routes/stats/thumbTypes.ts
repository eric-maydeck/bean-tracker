import type { PageData } from './$types';
import type { InsightsView } from '#lib/insightsUrl.ts';
import type { Thumb } from '#lib/linkPreview.ts';

// One Stats chart's link-preview thumbnail: its title and picture for the linked view, or null (text card).
export interface ThumbCtx { data: PageData; s: InsightsView; periodLabel: string; compareLabel: string; perPerson: boolean }
export type ThumbFn = (c: ThumbCtx) => { title: string; thumb: Thumb } | null;
