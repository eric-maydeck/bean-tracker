// "Today" is the local calendar date (the user's zone, BC_TIME_ZONE), never UTC's: from 18:00 local
// UTC is already tomorrow. Relative .ts import so node scripts (ui-seed) can load coffees.ts.
import { BC_TIME_ZONE } from './beanConquerorJson.ts';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BC_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export const localToday = (now = new Date()): string => dayFmt.format(now); // en-CA → YYYY-MM-DD

// The same day as a UTC-midnight Date, what urgency.ts / subscriptions.ts date math expects.
export const localTodayDate = (now = new Date()): Date => new Date(`${localToday(now)}T00:00:00Z`);
