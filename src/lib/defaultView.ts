export type ResponsiveView = 'compact' | 'list';

const MOBILE_BREAKPOINT_PX = 640;

export function defaultViewForWidth(width: number): ResponsiveView {
  // Inclusive: matches the CSS breakpoint (`@media (max-width: 640px)`,
  // which also treats 640 as narrow) rather than diverging from it.
  return width <= MOBILE_BREAKPOINT_PX ? 'compact' : 'list';
}
