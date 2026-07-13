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
