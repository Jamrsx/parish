import { api } from './api';
import type { ApiResponse } from './api';

export type PriestAssignmentStatus = 'pending' | 'approved' | 'done';

export interface PriestAssignment {
  request_id: number;
  date: string;
  time: string;
  service_type: string;
  status: PriestAssignmentStatus;
  client_name?: string | null;
  requested_by?: string | null;
}

export interface OtherBooking {
  request_id: number;
  date: string;
  time: string;
  service_type: string;
  status: string;
  assigned_priest_name: string | null;
}

export interface PriestTimeOff {
  time_off_id: number;
  priest_id: number;
  priest_name: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  whole_day: boolean;
  reason: string | null;
  label: string;
  created_by: number | null;
  created_by_name: string | null;
  added_by_priest: boolean;
  created_at: string | null;
}

export interface PriestScheduleCounts {
  upcoming_count: number;
  this_week_count: number;
  this_month_count: number;
  next_assignment: PriestAssignment | null;
}

export interface PriestScheduleSummaryRow extends PriestScheduleCounts {
  priest_id: number;
  is_active: boolean;
  is_available: boolean;
  unavailable_until: string | null;
  off_today: PriestTimeOff | null;
  next_time_off: PriestTimeOff | null;
}

export interface PriestScheduleDetails {
  priest: {
    user_id: number;
    full_name: string;
    email: string | null;
    contact_number: string | null;
    is_active: boolean;
    is_available: boolean;
    unavailable_until: string | null;
  };
  from: string;
  to: string;
  time_slots: string[];
  assignments: PriestAssignment[];
  other_bookings: OtherBooking[];
  time_off: PriestTimeOff[];
  summary: PriestScheduleCounts;
}

export interface PriestCalendarData {
  from: string;
  to: string;
  time_slots: string[];
  is_available: boolean;
  unavailable_until: string | null;
  assignments: PriestAssignment[];
  time_off: PriestTimeOff[];
  upcoming_time_off: PriestTimeOff[];
}

export interface TimeOffPayload {
  start_date: string;
  end_date: string;
  whole_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
  confirm?: boolean;
}

/** A service the time off would cover (returned with HTTP 409 until confirmed). */
export interface TimeOffConflict {
  request_id: number;
  date: string;
  time: string;
  service_type: string;
  status: string;
  requested_by: string | null;
}

export interface AssignmentConflict extends TimeOffConflict {
  priest_id: number;
  priest_name: string;
  problem: string;
}

export interface AllPriestTimeOff {
  from: string;
  to: string;
  time_off: PriestTimeOff[];
  switched_off: { priest_id: number; priest_name: string; unavailable_until: string | null }[];
}

/** "13:00" -> "1:00 PM" */
export const formatHm = (hm: string): string => {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** Short label for a calendar cell, e.g. "Off" or "Off 1–3 PM". */
export const timeOffShortLabel = (entry: PriestTimeOff): string =>
  entry.whole_day || !entry.start_time || !entry.end_time
    ? 'Off'
    : `Off ${formatHm(entry.start_time)}–${formatHm(entry.end_time)}`;

/** "2026-10-06" or ISO date-time -> "Oct 6, 2026" */
export const formatShortDate = (value: string): string => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Builds the forDate/forTime options for usersAPI.listPriests from a request's date and time values. */
export const priestSlotFor = (date?: string | null, time?: string | null): { forDate?: string; forTime?: string } => {
  const matches = time ? time.match(/\d{2}:\d{2}/g) : null;
  return {
    forDate: date ? date.slice(0, 10) : undefined,
    forTime: matches && matches.length ? matches[matches.length - 1] : undefined,
  };
};

export const TIME_OFF_END_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

/** Whether a time-off entry covers a date (and a time slot when given). */
export const timeOffCovers = (entry: PriestTimeOff, date: string, time?: string): boolean => {
  if (date < entry.start_date || date > entry.end_date) return false;
  if (entry.whole_day || !entry.start_time || !entry.end_time) return true;
  if (!time) return true;
  const t = time.slice(0, 5);
  return t >= entry.start_time && t < entry.end_time;
};

export const priestScheduleAPI = {
  getSummary: () =>
    api.get<ApiResponse<PriestScheduleSummaryRow[]>>('/admin/priests/schedule-summary'),

  getSchedule: (priestId: number, from: string, to: string) =>
    api.get<ApiResponse<PriestScheduleDetails>>(`/admin/priests/${priestId}/schedule`, {
      params: { from, to },
    }),

  getAllTimeOff: (from: string, to: string) =>
    api.get<ApiResponse<AllPriestTimeOff>>('/admin/priests/time-off', { params: { from, to } }),

  getAssignmentConflicts: () =>
    api.get<ApiResponse<{ count: number; items: AssignmentConflict[] }>>('/admin/priests/assignment-conflicts'),

  addTimeOffFor: (priestId: number, payload: TimeOffPayload) => {
    console.log('[PriestTimeOff] Secretary adds for priest', priestId, payload);
    return api.post<ApiResponse<PriestTimeOff> & { conflicts?: TimeOffConflict[] }>(
      `/admin/priests/${priestId}/time-off`,
      payload
    );
  },

  removeTimeOffFor: (priestId: number, timeOffId: number) =>
    api.delete<ApiResponse<null>>(`/admin/priests/${priestId}/time-off/${timeOffId}`),
};

export const myCalendarAPI = {
  get: (from: string, to: string) =>
    api.get<ApiResponse<PriestCalendarData>>('/priest/calendar', { params: { from, to } }),

  addTimeOff: (payload: TimeOffPayload) => {
    console.log('[MyCalendar] Add time off', payload);
    return api.post<ApiResponse<PriestTimeOff> & { conflicts?: TimeOffConflict[] }>('/priest/time-off', payload);
  },

  updateTimeOff: (id: number, payload: TimeOffPayload) => {
    console.log('[MyCalendar] Update time off', id, payload);
    return api.put<ApiResponse<PriestTimeOff> & { conflicts?: TimeOffConflict[] }>(`/priest/time-off/${id}`, payload);
  },

  removeTimeOff: (id: number) => api.delete<ApiResponse<null>>(`/priest/time-off/${id}`),
};
