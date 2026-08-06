import { endOfDay, format, parse, startOfDay, subDays } from "date-fns";

const DATE_KEY_FORMAT = "yyyy-MM-dd";

/** Convert an instant to the user's local calendar date. */
export function localDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, DATE_KEY_FORMAT);
}

/** Parse a stored calendar date without treating it as UTC. */
export function localDateFromKey(dateKey: string): Date {
  return parse(dateKey, DATE_KEY_FORMAT, new Date());
}

/** UTC ISO bounds corresponding to one local calendar day. */
export function localDayIsoRange(date: Date = new Date()): {
  start: string;
  end: string;
} {
  return {
    start: startOfDay(date).toISOString(),
    end: endOfDay(date).toISOString(),
  };
}

/** Start of a rolling local-day window, including today. */
export function localRangeStart(days: number, now: Date = new Date()): Date {
  return startOfDay(subDays(now, Math.max(0, days - 1)));
}
