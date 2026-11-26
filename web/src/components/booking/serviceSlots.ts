import { availabilityAPI } from '../../../library/Availability';

/** Hourly service slots (must match ManageRequest::SERVICE_TIME_SLOTS on the backend). */
export const SERVICE_TIME_OPTIONS = [
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:00 AM', value: '11:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '1:00 PM', value: '13:00' },
  { label: '2:00 PM', value: '14:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '4:00 PM', value: '16:00' },
  { label: '5:00 PM', value: '17:00' },
];

/** 5-hour blocks for Marriage and Funeral Mass (must match ManageRequest::LONG_SERVICE_BLOCKS). */
const LONG_SERVICE_BLOCKS: Record<string, string[]> = {
  '08:00': ['08:00', '09:00', '10:00', '11:00', '12:00'],
  '13:00': ['13:00', '14:00', '15:00', '16:00', '17:00'],
};

export const isLongService = (formHandler?: string | null): boolean =>
  ['marriage', 'funeral_mass'].includes((formHandler || '').toLowerCase());

/** Range labels for the two Marriage / Funeral Mass blocks, so the whole block is clear. */
export const LONG_SERVICE_BLOCK_LABELS: Record<string, string> = {
  '08:00': '8:00 AM – 12:00 PM',
  '13:00': '1:00 PM – 5:00 PM',
};

/** Time choices for a service: two 5-hour blocks for long services, otherwise every hour. */
export const timeOptionsFor = (longService = false) =>
  longService
    ? SERVICE_TIME_OPTIONS.filter((opt) => opt.value in LONG_SERVICE_BLOCKS).map((opt) => ({
        ...opt,
        label: LONG_SERVICE_BLOCK_LABELS[opt.value] ?? opt.label,
      }))
    : SERVICE_TIME_OPTIONS;

/** "8:00 AM – 12:00 PM" for a long-service block start, otherwise null (use the normal time label). */
export const longServiceRangeLabel = (time: string | null | undefined, formHandler?: string | null): string | null =>
  isLongService(formHandler) ? LONG_SERVICE_BLOCK_LABELS[(time || '').slice(0, 5)] ?? null : null;

export type SlotState = 'open' | 'booked' | 'passed';

export type TimeOption = {
  label: string;
  value: string;
  state: SlotState;
  disabled: boolean;
  /** Label with " — Booked" / " — Passed" added, for <option> text. */
  display: string;
};

export const toYmd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const toHm = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const normalizeHm = (time: string): string => (time || '').slice(0, 5);

export const isBookedTime = (time: string, booked: string[], longService = false): boolean => {
  const hm = normalizeHm(time);
  const needed = longService ? LONG_SERVICE_BLOCKS[hm] ?? [hm] : [hm];
  return booked.some((b) => needed.includes(normalizeHm(b)));
};

export const isPastTime = (date: string, time: string): boolean => {
  if (!date || !time) return false;
  const now = new Date();
  const today = toYmd(now);
  if (date < today) return true;
  return date === today && normalizeHm(time) <= toHm(now);
};

export const getSlotState = (
  date: string,
  time: string,
  booked: string[],
  checkBooked = true,
  longService = false,
): SlotState => {
  if (isPastTime(date, time)) return 'passed';
  if (checkBooked && isBookedTime(time, booked, longService)) return 'booked';
  return 'open';
};

/**
 * Every slot for a date, marked open / booked / passed.
 * `checkBooked` is false for certificate visit times, which do not compete for slots.
 * `longService` limits the list to 5-hour starts and needs the whole block free.
 */
export const buildTimeOptions = (
  date: string,
  booked: string[],
  checkBooked = true,
  longService = false,
): TimeOption[] =>
  timeOptionsFor(longService).map((opt) => {
    const state = date ? getSlotState(date, opt.value, booked, checkBooked, longService) : 'open';
    return {
      ...opt,
      state,
      disabled: state !== 'open',
      display: state === 'booked' ? `${opt.label} — Booked` : state === 'passed' ? `${opt.label} — Passed` : opt.label,
    };
  });

/** User-facing reason a chosen time cannot be used, or null when it is fine. */
export const timeProblem = (
  date: string,
  time: string,
  booked: string[],
  checkBooked = true,
  longService = false,
): string | null => {
  if (longService && !(normalizeHm(time) in LONG_SERVICE_BLOCKS)) {
    return 'Marriage and Funeral Mass can only start at 8:00 AM or 1:00 PM.';
  }
  const state = getSlotState(date, time, booked, checkBooked, longService);
  if (state === 'passed') return 'That time has already passed. Please choose a later time.';
  if (state === 'booked') return 'That time is already booked. Please choose another time.';
  return null;
};

const monthCache = new Map<string, { at: number; dates: string[] }>();
const MONTH_CACHE_MS = 60_000;

/** Fully booked dates for one calendar month ("YYYY-MM"), cached briefly. */
export const fetchFullyBookedMonth = async (month: string, force = false): Promise<string[]> => {
  const cached = monthCache.get(month);
  if (!force && cached && Date.now() - cached.at < MONTH_CACHE_MS) return cached.dates;

  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = toYmd(new Date(y, m, 0));
  const res = await availabilityAPI.getFullyBookedDates(from, to);
  const dates = res.success ? res.data?.fully_booked_dates || [] : [];
  console.log('[Booking] Fully booked dates', { month, dates });
  monthCache.set(month, { at: Date.now(), dates });
  return dates;
};
