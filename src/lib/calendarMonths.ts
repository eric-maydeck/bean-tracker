export const MAX_MONTHS = 24;

// The brew calendar shows at most the latest `max` calendar months of the (date-ordered) days.
export function latestMonths<T extends { date: string }>(days: T[], max = MAX_MONTHS): { days: T[]; cut: boolean } {
  const months = [...new Set(days.map((d) => d.date.slice(0, 7)))];
  if (months.length <= max) return { days, cut: false };
  const from = months[months.length - max];
  return { days: days.filter((d) => d.date.slice(0, 7) >= from), cut: true };
}
