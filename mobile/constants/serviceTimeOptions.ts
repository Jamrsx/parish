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

/** Range labels for the two Marriage / Funeral Mass blocks, so the whole block is clear. */
export const LONG_SERVICE_BLOCK_LABELS: Record<string, string> = {
  '08:00': '8:00 AM – 12:00 PM',
  '13:00': '1:00 PM – 5:00 PM',
};

/** Time choices for a service: two 5-hour blocks for long services, otherwise every hour. */
export const timeOptionsFor = (longService = false) =>
  longService
    ? SERVICE_TIME_OPTIONS.filter((t) => t.value in LONG_SERVICE_BLOCKS).map((t) => ({
        ...t,
        label: LONG_SERVICE_BLOCK_LABELS[t.value] ?? t.label,
      }))
    : SERVICE_TIME_OPTIONS;

/** True when the time, or for a long service any hour of its block, is already booked. */
export const isBookedServiceTime = (time: string, bookedSlots: string[], longService = false): boolean => {
  const value = normalizeTimeValue(time);
  const needed = longService ? LONG_SERVICE_BLOCKS[value] ?? [value] : [value];
  return bookedSlots.some((slot) => needed.includes(normalizeTimeValue(slot)));
};

export const getDisplayTimeLabel = (time24Hour: string, longService = false): string => {
  if (!time24Hour) return 'Select time';
  const option = timeOptionsFor(longService).find((t) => t.value === time24Hour);
  return option ? option.label : 'Select time';
};

export const normalizeTimeValue = (time: string): string => {
  if (!time) return '';
  return time.length >= 5 ? time.slice(0, 5) : time;
};

export const toDateString = (year: number, month: number, day: number): string =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const isPastServiceTime = (date: string, time: string): boolean => {
  if (!date || !time) return false;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = normalizeTimeValue(time).split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hh)) return false;
  return new Date(y, m - 1, d, hh, mm || 0).getTime() <= Date.now();
};

export const getServiceTimeProblem = (
  date: string,
  time: string,
  bookedSlots: string[] = [],
  longService = false
): string | null => {
  if (!date || !time) return null;
  const value = normalizeTimeValue(time);
  if (longService && !(value in LONG_SERVICE_BLOCKS)) {
    return 'Marriage and Funeral Mass can only start at 8:00 AM or 1:00 PM.';
  }
  if (isPastServiceTime(date, value)) {
    return 'That time has already passed. Please choose a later time.';
  }
  if (isBookedServiceTime(value, bookedSlots, longService)) {
    return 'This time is already booked. Please choose another time.';
  }
  return null;
};
