// Plain tsc can't read types from .svelte files; svelte-check still checks these names against Icon's.
type NavIcon = 'coffee' | 'list-checks' | 'arrows-clockwise' | 'chart-bar' | 'gear' | 'drop' | 'book-open';
import { TAB_GROUPS, TABS, type Tab } from '#lib/insightsUrl.ts';

export type NavRow = { href: string; label: string; icon: NavIcon; children?: 'stats' };

export const MAIN_ROWS: readonly NavRow[] = [
  { href: '/coffees', label: 'Coffees', icon: 'coffee' },
  { href: '/on-deck', label: 'On Deck', icon: 'list-checks' },
  { href: '/subscriptions', label: 'Subscriptions', icon: 'arrows-clockwise' },
  { href: '/stats', label: 'Stats', icon: 'chart-bar', children: 'stats' },
  { href: '/gear', label: 'Gear', icon: 'gear' },
  { href: '/water', label: 'Water', icon: 'drop' },
  { href: '/recipes', label: 'Recipes', icon: 'book-open' }
];

// The phone bottom bar's page slots (the account slot and Menu are rendered separately).
export const PHONE_BAR: readonly ('/coffees' | '/on-deck' | '/stats')[] = ['/coffees', '/on-deck', '/stats'];

export const isCurrent = (href: string, pathname: string): boolean => pathname === href || pathname.startsWith(`${href}/`);

export const panelFor = (pathname: string): 'main' | 'stats' => (pathname === '/stats' ? 'stats' : 'main');

// The /stats view a URL names (case-insensitive; none or unknown = Overview, as the page renders it).
type UrlLike = { pathname: string; searchParams: { get(k: string): string | null } }; // URL, or page.url's read-only one
export const statsTabOf = (u: UrlLike): Tab => {
  const t = (u.searchParams.get('tab') ?? '').toLowerCase();
  return (TABS as readonly string[]).includes(t) ? (t as Tab) : 'overview';
};

// The /stats view a navigation is heading to (navigating.to), or null: a tapped view reads current while its data loads (#206).
export const pendingStatsTab = (to: UrlLike | null | undefined): Tab | null => (to?.pathname === '/stats' ? statsTabOf(to) : null);

// The Recaps group appears only while there is a recap to open.
export const statsGroups = (showRecaps: boolean): typeof TAB_GROUPS => TAB_GROUPS.filter((g) => showRecaps || g.label !== 'Recaps');

// saved = the remembered /stats query (withoutDeepLinks(loadInsightsState(...))) or null.
export function statsViewHref(tab: Tab, saved: string | null): string {
  const rest = new URLSearchParams(saved ?? '');
  rest.delete('tab');
  // Overview is the default tab, so it is left out unless it is all that is left: a bare /stats would restore a remembered tab.
  const p = new URLSearchParams(tab === 'overview' && rest.size > 0 ? '' : { tab });
  for (const [k, v] of rest) p.append(k, v);
  return `/stats?${p}`;
}

export const icon = (row: NavRow, current: boolean): NavIcon | `${NavIcon}-fill` => (current ? `${row.icon}-fill` : row.icon);
