// "Today" is the calendar date in the brewing zone (src/lib/localDate.ts), not UTC's. Relative .ts import so node scripts (ui-seed) can load coffees.ts.
import { localDate } from '../localDate.ts';

export const localToday = (now = new Date()): string => localDate(now.toISOString());

// The same day as a UTC-midnight Date, what urgency.ts / subscriptions.ts date math expects.
export const localTodayDate = (now = new Date()): Date => new Date(`${localToday(now)}T00:00:00Z`);
