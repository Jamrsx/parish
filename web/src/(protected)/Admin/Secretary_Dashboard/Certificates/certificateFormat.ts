const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

const parseYmd = (value?: string | null): { y: number; m: number; d: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
};

const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

/** "2023-08-27" → "27th day of August, 2023" */
export const formatDayOfMonth = (value?: string | null): string => {
  const p = parseYmd(value);
  if (!p) return '';
  return `${ordinal(p.d)} day of ${MONTHS[p.m - 1]}, ${p.y}`;
};

/** "2026-03-15" → "Mar. 15, 2026" */
export const formatIssuedDate = (value?: string | null): string => {
  const p = parseYmd(value);
  if (!p) return '';
  return `${SHORT_MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
};

/** "2026-03-15" → "March 15, 2026" */
export const formatLongDate = (value?: string | null): string => {
  const p = parseYmd(value);
  if (!p) return '—';
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
};

export const todayYmd = (): string => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
};

/** "REV. FR. JUAN P. DELA CRUZ, SSJV" → "JC" */
export const priestInitials = (name: string): string => {
  const words = name
    .replace(/^(most\s+)?rev\.?\s*(fr\.?)?\s*/i, '')
    .replace(/,.*$/, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] || '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
};

/** Adds "REV. FR." unless the name already carries a clerical title. */
export const withPriestTitle = (name?: string | null): string => {
  const clean = (name || '').trim();
  if (!clean) return '';
  if (/^(rev|fr|msgr|bishop|most rev)\b/i.test(clean)) return clean.toUpperCase();
  return `REV. FR. ${clean}`.toUpperCase();
};
