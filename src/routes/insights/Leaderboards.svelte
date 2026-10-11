<script lang="ts">
  import type { Board, InsightsUrlState, Rank, Ratings } from '$lib/insightsUrl';
  import type { PageData } from './$types';
  let {
    boards
  }: {
    boards: NonNullable<PageData['boards']>; rank: Rank; ratings: Ratings; open: Board | undefined; comparing: boolean;
    perPerson: boolean; ratingsHelp: Record<Ratings, string>; choose: (c: InsightsUrlState) => void;
  } = $props();
</script>

<p>{Object.keys(boards).length} boards</p>
