import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';

export interface CashierDashboardData {
  unpaid_count: number;
  pending_donations: number;
  pending_mass_collections?: number;
  pending_special_intentions?: number;
  service_payments_today: number;
  service_payments_today_count: number;
  mass_collections_today: number;
  donations_received_today: number;
  special_intentions_today?: number;
  recent_payments: PaymentTransactionRow[];
  recent_mass_collections: MassCollectionRow[];
  date: string;
}

export interface UnpaidRequestRow {
  request_id: number;
  user?: { user_id: number; full_name?: string; first_name?: string; last_name?: string } | null;
  service?: { service_id: number; service_type: string; fee: number } | null;
  preferred_date?: string;
  preferred_time?: string;
  status: string;
  payment_status: string;
  amount_paid: number;
  remaining_balance: number;
  form_summary?: string;
  created_at?: string;
}

export interface PaymentTransactionRow {
  payment_id: number;
  request_id: number;
  amount: number;
  or_number?: string | null;
  notes?: string | null;
  created_at?: string;
  parishioner?: string;
  service_type?: string;
  received_by?: string;
}

export interface DenominationLine {
  denomination: number;
  count: number;
  total: number;
}

export interface MassCollectionRow {
  collection_id: number;
  mass_date: string;
  mass_type: string;
  mass_time?: string | null;
  amount: number;
  denomination_breakdown?: DenominationLine[];
  notes?: string | null;
  status?: 'pending' | 'received' | 'rejected';
  recorded_by?: string;
  received_by?: string | null;
  received_at?: string | null;
  reject_reason?: string | null;
  created_at?: string;
}

export interface DonationRow {
  donation_id: number;
  donor_name: string;
  contribution_type?: 'donation' | 'love_offering';
  amount: number;
  denomination_breakdown?: DenominationLine[];
  donation_date: string;
  notes?: string | null;
  status: 'pending' | 'received' | 'rejected';
  recorded_by?: string;
  received_by?: string | null;
  received_at?: string | null;
  reject_reason?: string | null;
  created_at?: string;
}

export interface SpecialIntentionRow {
  intention_id: number;
  user_id?: number | null;
  request_id?: number | null;
  parishioner_name: string;
  intention_text: string;
  amount: number;
  denomination_breakdown?: DenominationLine[];
  intention_date: string;
  notes?: string | null;
  source?: 'secretary' | 'parishioner';
  status: 'pending' | 'approved' | 'received' | 'rejected';
  recorded_by?: string;
  received_by?: string | null;
  received_at?: string | null;
  reject_reason?: string | null;
  created_at?: string;
  min_offering?: number;
  any_amount?: boolean;
}

export interface DailyReportData {
  date: string;
  service_payments: PaymentTransactionRow[];
  service_fees_total: number;
  mass_collections: MassCollectionRow[];
  mass_collections_total: number;
  donations: DonationRow[];
  donations_total: number;
  special_intentions: SpecialIntentionRow[];
  special_intentions_total: number;
  income_for_date: number;
}

export const cashierAPI = {
  dashboard: () => api.get<ApiResponse<CashierDashboardData>>('/admin/cashier/dashboard'),

  unpaidRequests: (params?: { search?: string; payment_status?: string; per_page?: number; page?: number }) =>
    api.get<ApiResponse<PaginatedResponse<UnpaidRequestRow>>>('/admin/cashier/unpaid-requests', { params }),

  transactions: (params?: { date_from?: string; date_to?: string; search?: string; per_page?: number; page?: number }) =>
    api.get<ApiResponse<PaginatedResponse<PaymentTransactionRow>>>('/admin/cashier/transactions', { params }),

  dailyReport: (date: string) =>
    api.get<ApiResponse<DailyReportData>>('/admin/cashier/daily-report', { params: { date } }),

  recordPayment: (requestId: number, data: { amount: number; or_number?: string; notes?: string }) =>
    api.post(`/admin/requests/${requestId}/pay`, data),
};

export const massCollectionAPI = {
  list: (params?: { status?: string; date_from?: string; date_to?: string; per_page?: number; page?: number }) =>
    api.get<ApiResponse<PaginatedResponse<MassCollectionRow>>>('/admin/mass-collections', { params }),

  create: (data: {
    mass_date: string;
    mass_type: string;
    mass_time?: string;
    notes?: string;
    denomination_breakdown: { denomination: number; count: number; total?: number }[];
  }) => api.post<ApiResponse<MassCollectionRow>>('/admin/mass-collections', data),

  approve: (id: number) => api.post<ApiResponse<MassCollectionRow>>(`/admin/mass-collections/${id}/approve`),

  reject: (id: number, reject_reason: string) =>
    api.post<ApiResponse<MassCollectionRow>>(`/admin/mass-collections/${id}/reject`, { reject_reason }),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/admin/mass-collections/${id}`),
};

export const donationAPI = {
  list: (params?: {
    status?: string;
    contribution_type?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    per_page?: number;
    page?: number;
  }) => api.get<ApiResponse<PaginatedResponse<DonationRow>>>('/admin/donations', { params }),

  create: (data: {
    donor_name?: string;
    contribution_type: 'donation' | 'love_offering';
    donation_date: string;
    notes?: string;
    denomination_breakdown: { denomination: number; count: number; total?: number }[];
  }) => api.post<ApiResponse<DonationRow>>('/admin/donations', data),

  approve: (id: number) => api.post<ApiResponse<DonationRow>>(`/admin/donations/${id}/approve`),

  reject: (id: number, reject_reason: string) =>
    api.post<ApiResponse<DonationRow>>(`/admin/donations/${id}/reject`, { reject_reason }),
};

export const specialIntentionAPI = {
  list: (params?: { status?: string; date_from?: string; date_to?: string; search?: string; per_page?: number; page?: number }) =>
    api.get<ApiResponse<PaginatedResponse<SpecialIntentionRow>>>('/admin/special-intentions', { params }),

  create: (data: {
    parishioner_name: string;
    intention_text: string;
    intention_date: string;
    notes?: string;
    denomination_breakdown: { denomination: number; count: number; total?: number }[];
  }) => api.post<ApiResponse<SpecialIntentionRow>>('/admin/special-intentions', data),

  secretaryApprove: (id: number) =>
    api.post<ApiResponse<SpecialIntentionRow>>(`/admin/special-intentions/${id}/secretary-approve`),

  secretaryReject: (id: number, reject_reason: string) =>
    api.post<ApiResponse<SpecialIntentionRow>>(`/admin/special-intentions/${id}/secretary-reject`, { reject_reason }),

  approve: (id: number, data?: { amount?: number }) =>
    api.post<ApiResponse<SpecialIntentionRow>>(`/admin/special-intentions/${id}/approve`, data || {}),

  reject: (id: number, reject_reason: string) =>
    api.post<ApiResponse<SpecialIntentionRow>>(`/admin/special-intentions/${id}/reject`, { reject_reason }),

  remove: (id: number) => api.delete<ApiResponse<null>>(`/admin/special-intentions/${id}`),
};
