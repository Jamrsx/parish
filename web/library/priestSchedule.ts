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
}

export interface PriestScheduleDetails {
  priest: {
    user_id: number;
    full_name: string;
    email: string | null;
    contact_number: string | null;
    is_active: boolean;
    is_available: boolean;
  };
  from: string;
  to: string;
  time_slots: string[];
  assignments: PriestAssignment[];
  other_bookings: OtherBooking[];
  summary: PriestScheduleCounts;
}

export const priestScheduleAPI = {
  getSummary: () =>
    api.get<ApiResponse<PriestScheduleSummaryRow[]>>('/admin/priests/schedule-summary'),

  getSchedule: (priestId: number, from: string, to: string) =>
    api.get<ApiResponse<PriestScheduleDetails>>(`/admin/priests/${priestId}/schedule`, {
      params: { from, to },
    }),
};
