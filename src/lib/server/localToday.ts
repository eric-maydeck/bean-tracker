// "Today" is the local calendar date (the user's zone, APP_TIME_ZONE), never UTC's: from 18:00 local
// UTC is already tomorrow. Relative .ts import so node scripts (ui-seed) can load coffees.ts.
import { localDate } from '../localDate.ts';

export const localToday = (now = new Date()): string => localDate(now.toISOString());

// The same day as a UTC-midnight Date, what urgency.ts / subscriptions.ts date math expects.
export const localTodayDate = (now = new Date()): Date => new Date(`${localToday(now)}T00:00:00Z`);
