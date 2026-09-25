// Pure decisions behind CoffeeForm's fill UI. Client-safe (no $lib/server
// imports) so the component can use it; unit-tested because there's no
// component-test layer (HANDOFF).

// After a failed fill the URL field goes back to what it held before that
// fill; the tried URL is offered for saving anyway unless it's the same.
export function afterFailedFill(
  tried: string,
  lastFilled: string | null,
  original: string
): { revertTo: string; offer: string | null } {
  const revertTo = lastFilled ?? original;
  return { revertTo, offer: tried !== revertTo ? tried : null };
}
