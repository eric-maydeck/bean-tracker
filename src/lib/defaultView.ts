export type ResponsiveView = 'compact' | 'list';

const MOBILE_BREAKPOINT_PX = 640;

export function defaultViewForWidth(width: number): ResponsiveView {
  return width < MOBILE_BREAKPOINT_PX ? 'compact' : 'list';
}
