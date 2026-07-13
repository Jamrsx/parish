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
