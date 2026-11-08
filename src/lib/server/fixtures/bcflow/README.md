# bcflow fixtures

Invented Bean Conqueror `brews/<uuid>_flow_profile.json` files for `../../bcFlow.test.ts`,
`../../pourDetector.test.ts` and the recipe tests. Each is a piecewise-linear weight curve on a 0.1 s
grid, drawn to show one brew shape. `weight[]` entries have only `brew_time` and
`actual_smoothed_weight`; `realtimeFlow[]` and `waterFlow[]` hold 3 placeholder entries (to show the
parser ignores them).

| File | Shape |
| --- | --- |
| bbs.json | two ~20 s blooms, three fast pours and a slow one; a dripper lift (swirl) |
| bbj.json | three fast pours, then two slow ones |
| bbf.json | three fast pours and a slow one |
| 4sy.json | one bloom, four fast pours |
| 5sy.json | five fast pours |
| swirl.json | a rise >= 40 g within 0.3 s that falls back within 10 s; the scale holds only 52 g |
| tare.json | a tare at 16 s (weight snaps to 0 and stays); cut at 125 s |
| bbs-30s.json | like bbs, with two ~30 s blooms |
| long-pour.json | two fast pours and one long slow pour |

Logged values the detector tests pass (water g, dose g, brew time s): bbs 295.3/18/117, bbj 244.7/15.8/96,
bbf 324/18/130, 4sy 303.3/18.1/88, 5sy 304/20.2/70, swirl 272/18.1/114 (the scale only holds 52 g of it:
the log cannot reconcile, so it reads low confidence), tare 325.8/18.1/125 (truncated, so 125),
bbs-30s 335.7/20.1/120, long-pour 336.6/20.2/127.

## Detector notes

`../../pourDetector.ts` reads the interpolated curve at a fixed 0.1 s step (never sample to sample), so
raw and compact series read alike. Constants live in `$lib/pours.ts`:

- **Fast/slow uses the 1 s peak**, not the average: a pour's average depends on how the run is cut,
  while peaks separate cleanly. A pour is fast when its peak is >= `FAST_GPS` and its average is >=
  `FAST_MIN_AVG_GPS` (a slow pour ending in a swirl-like spike peaks high but averages low).
- A fast non-bloom pour that is under `FAST_REL_AVG` x the median average of the brew's other fast pours
  AND over 3x their median duration is slow (needs >= 3 fast pours).
- A run that only climbs back to a level the brew already reached (< 10 g above the earlier maximum) is
  not a pour (a dripper lift's dip and recovery).
- Swings whose padded ends overlap bridge as one (if the result is <= 10 s), and the bridge starts at the
  higher of the levels 0.5 s and 2 s before, so a slow dip can't anchor it low.
- A dip through zero that comes back within 10 s is a dripper lift or swirl, not a tare. A tare snap stays
  down.
- Pour grams are read 3 s after the run ends (or at the next run), so a fast pour's impact overshoot is not
  counted.
- A pour's duration is its run minus the 1 s window overlap.

## Compact format

Stored curves use 0.05 s steps, interpolated, plus the extreme sample when it is more than 20 g off the
interpolation (keeps tare snaps and swirl spikes); `bcFlow.test.ts` checks that raw and compact read alike.
