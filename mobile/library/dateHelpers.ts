/**
 * Local calendar date helpers (Philippine / device timezone).
 * Avoid Date#toISOString() for "today" — that uses UTC and can be yesterday early morning.
 */

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayLocalDateString(): string {
  return getLocalDateString(new Date());
}

/**
 * Calendar view helpers. The view always sits on day 1, so moving from a long month
 * (Jan 31) or a leap day (Feb 29) cannot overflow into the wrong month.
 */
export function shiftCalendarMonth(date: Date, increment: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + increment, 1);
}

export function setCalendarYear(date: Date, year: number): Date {
  return new Date(year, date.getMonth(), 1);
}

/** Opens the calendar on a saved "YYYY-MM-DD" value in local time, or on this month. */
export function calendarMonthFrom(value?: string | null): Date {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? '');
  if (!match) return shiftCalendarMonth(new Date(), 0);
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}
