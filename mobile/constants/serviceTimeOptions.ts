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

export const getDisplayTimeLabel = (time24Hour: string): string => {
  if (!time24Hour) return 'Select time';
  const option = SERVICE_TIME_OPTIONS.find((t) => t.value === time24Hour);
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
  bookedSlots: string[] = []
): string | null => {
  if (!date || !time) return null;
  const value = normalizeTimeValue(time);
  if (isPastServiceTime(date, value)) {
    return 'That time has already passed. Please choose a later time.';
  }
  if (bookedSlots.some((slot) => normalizeTimeValue(slot) === value)) {
    return 'This time is already booked. Please choose another time.';
  }
  return null;
};
