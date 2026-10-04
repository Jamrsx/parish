import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';
import type { IncomeSplit } from './secretary-dashboard';

/** Secretary and cashier read from /admin/history, the priest from /priest/history (same data, view only). */
export type HistoryScope = 'admin' | 'priest';

export type ServiceStatus = 'pending' | 'approved' | 'done' | 'cancelled';

export interface ServiceHistoryRow {
  request_id: number;
  reference: string;
  service_type: string;
  category: string | null;
  client_name: string | null;
  requested_by: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: ServiceStatus;
  payment_status: 'unpaid' | 'partial' | 'paid';
  fee: number;
  amount_paid: number;
  assigned_priest: string | null;
  was_rescheduled: boolean;
  reschedule_reason: string | null;
  cancelled_reason: string | null;
  created_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
}

export type TimelineEventType =
  | 'requested'
  | 'approved'
  | 'priest_assigned'
  | 'rescheduled'
  | 'paid'
  | 'completed'
  | 'cancelled'
  | 'certificate'
  | 'edited';

export interface TimelineEvent {
  at: string;
  type: TimelineEventType;
  title: string;
  detail: string | null;
  by: string | null;
  amount: number | null;
}

export interface ServiceTimeline {
  request: ServiceHistoryRow;
  events: TimelineEvent[];
}

export type TransactionType =
  | 'service_fee'
  | 'reprint'
  | 'mass_collection'
  | 'donation'
  | 'love_offering'
  | 'special_intention'
  | 'expense';

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  service_fee: 'Service payment',
  reprint: 'Certificate reprint',
  mass_collection: 'Mass collection',
  donation: 'Donation',
  love_offering: 'Love offering',
  special_intention: 'Special intention',
  expense: 'Church expense',
};

export interface LedgerEntry {
  key: string;
  date_time: string | null;
  date: string | null;
  type: TransactionType;
  type_label: string;
  direction: 'in' | 'out';
  description: string;
  party: string | null;
  reference: string | null;
  amount_in: number;
  amount_out: number;
  recorded_by: string | null;
  approved_by: string | null;
  request_id: number | null;
}

export interface LedgerSummary {
  from: string;
  to: string;
  income_total: number;
  expense_total: number;
  net: number;
  sharing: IncomeSplit;
  church_net: number;
  by_type: { type: TransactionType; label: string; count: number; amount: number }[];
  filtered_in: number;
  filtered_out: number;
}

export interface ActivityLogEntry {
  log_id: number;
  created_at: string;
  user_name: string;
  user_role: string | null;
  action: string;
  subject_type: string;
  subject_label: string;
  subject_id: number | null;
  request_id: number | null;
  description: string;
  changes: Record<string, unknown> | null;
  amount: number | null;
}

export interface ServicesParams {
  status?: ServiceStatus;
  service_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface TransactionsParams {
  date_from?: string;
  date_to?: string;
  direction?: 'all' | 'in' | 'out';
  type?: TransactionType;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ActivityParams {
  date_from?: string;
  date_to?: string;
  subject_type?: string;
  action?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export const historyAPI = (scope: HistoryScope) => {
  const base = `/${scope}/history`;
  return {
    services: (params: ServicesParams) =>
      api.get<ApiResponse<PaginatedResponse<ServiceHistoryRow>> & { status_counts: Record<ServiceStatus, number> }>(
        `${base}/services`,
        { params }
      ),

    timeline: (requestId: number) => api.get<ApiResponse<ServiceTimeline>>(`${base}/services/${requestId}`),

    transactions: (params: TransactionsParams) =>
      api.get<ApiResponse<PaginatedResponse<LedgerEntry>> & { summary: LedgerSummary }>(`${base}/transactions`, {
        params,
      }),

    allTransactions: (params: TransactionsParams) =>
      api.get<ApiResponse<{ items: LedgerEntry[]; total: number }> & { summary: LedgerSummary }>(
        `${base}/transactions`,
        { params: { ...params, all: 1, page: undefined, per_page: undefined } }
      ),

    activity: (params: ActivityParams) =>
      api.get<
        ApiResponse<PaginatedResponse<ActivityLogEntry>> & {
          started_at: string | null;
          subject_types: Record<string, string>;
        }
      >(`${base}/activity`, { params }),
  };
};

export const formatPeso = (n: number) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export const formatDay = (value?: string | null) => {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** "13:00" -> "1:00 PM" */
export const formatClock = (hm?: string | null) => {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  pending: 'Pending',
  approved: 'Scheduled',
  done: 'Completed',
  cancelled: 'Cancelled',
};
