import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';

export interface CashierDashboardData {
  unpaid_count: number;
  pending_donations: number;
  pending_mass_collections?: number;
  service_payments_today: number;
  service_payments_today_count: number;
  mass_collections_today: number;
  donations_received_today: number;
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

export interface DailyReportData {
  date: string;
  service_payments: PaymentTransactionRow[];
  service_fees_total: number;
  mass_collections: MassCollectionRow[];
  mass_collections_total: number;
  donations: DonationRow[];
  donations_total: number;
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
  list: (params?: { status?: string; date_from?: string; date_to?: string; search?: string; per_page?: number; page?: number }) =>
    api.get<ApiResponse<PaginatedResponse<DonationRow>>>('/admin/donations', { params }),

  create: (data: {
    donor_name?: string;
    donation_date: string;
    notes?: string;
    denomination_breakdown: { denomination: number; count: number; total?: number }[];
  }) => api.post<ApiResponse<DonationRow>>('/admin/donations', data),

  approve: (id: number) => api.post<ApiResponse<DonationRow>>(`/admin/donations/${id}/approve`),

  reject: (id: number, reject_reason: string) =>
    api.post<ApiResponse<DonationRow>>(`/admin/donations/${id}/reject`, { reject_reason }),
};
