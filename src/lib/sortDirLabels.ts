// The sort-direction button's captions, the same on every page (/coffees, the Brew now picker, the Stats leaderboards):
// the aria-label names the sort in effect; the tooltip says what a tap switches to.
type SortDir = 'asc' | 'desc';
const word = (d: SortDir) => (d === 'asc' ? 'ascending' : 'descending');
export const sortDirLabel = (d: SortDir): string => `Sort ${word(d)}`;
export const sortDirTip = (d: SortDir): string => `${word(d)[0].toUpperCase()}${word(d).slice(1)}: tap for ${word(d === 'asc' ? 'desc' : 'asc')}`;
