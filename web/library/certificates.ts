import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';

export interface BaptismRecordOption {
  baptism_id: number;
  request_id: number;
  status: 'approved' | 'done';
  person_name: string;
  father_name: string;
  mother_name: string;
  birth_date: string | null;
  birth_place: string | null;
  baptism_date: string | null;
  minister_name: string | null;
  sponsors: string[];
  register_no: string | null;
  register_page: string | null;
  register_line: string | null;
}

export interface CertificateRequestOption {
  request_id: number;
  status: 'pending' | 'approved' | 'done';
  payment_status: 'unpaid' | 'partial' | 'paid';
  requested_by: string | null;
  requested_at: string | null;
  person_name: string;
  father_name: string | null;
  mother_name: string | null;
  birth_date: string | null;
  birth_place: string | null;
  baptism_date: string | null;
  matched_record: BaptismRecordOption | null;
}

export interface BaptismalCertificateDetails {
  person_name: string;
  father_name: string | null;
  mother_name: string | null;
  birth_date: string;
  birth_place: string | null;
  baptism_date: string;
  minister_name: string;
  sponsors: string[];
  register_no: string | null;
  register_page: string | null;
  register_line: string | null;
  purpose: string | null;
  date_issued: string;
  signatory_name: string;
}

export interface IssueCertificatePayload extends Omit<BaptismalCertificateDetails, 'sponsors'> {
  certificate_type: 'baptismal';
  sponsors: string[];
  signatory_priest_id: number | null;
  baptism_id: number | null;
  request_id: number | null;
}

export interface IssuedCertificateRow {
  issued_certificate_id: number;
  certificate_type: 'baptismal';
  person_name: string;
  purpose: string | null;
  date_issued: string;
  signatory_name: string;
  baptism_id: number | null;
  request_id: number | null;
  details: BaptismalCertificateDetails;
  issued_by: string | null;
  created_at: string;
}

export const certificatesAPI = {
  getBaptismRecords: (search?: string) =>
    api.get<ApiResponse<BaptismRecordOption[]>>('/admin/certificates/baptism-records', {
      params: search ? { search } : undefined,
    }),

  getCertificateRequests: (search?: string) =>
    api.get<ApiResponse<CertificateRequestOption[]>>('/admin/certificates/requests', {
      params: search ? { search } : undefined,
    }),

  getIssued: (params: { search?: string; page?: number; per_page?: number }) =>
    api.get<ApiResponse<PaginatedResponse<IssuedCertificateRow>>>('/admin/certificates/issued', { params }),

  issue: (payload: IssueCertificatePayload) =>
    api.post<ApiResponse<IssuedCertificateRow>>('/admin/certificates/issue', payload),

  completeRequest: (requestId: number) =>
    api.post<ApiResponse<unknown>>(`/admin/requests/${requestId}/complete`),
};

export type ReprintStatus = 'awaiting_payment' | 'paid' | 'released' | 'cancelled';

export interface ReprintFeeSetting {
  amount: number;
  is_default: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export interface CertificateReprintRow {
  reprint_id: number;
  issued_certificate_id: number | null;
  person_name: string;
  certificate_type: string;
  amount: number;
  reason: string | null;
  status: ReprintStatus;
  requested_by: string | null;
  requested_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  or_number: string | null;
  payment_notes: string | null;
  released_by: string | null;
  released_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  purpose: string | null;
  details?: BaptismalCertificateDetails | null;
}

export type ReprintStatusCounts = Record<ReprintStatus, number>;

export interface ReprintListResponse {
  success: boolean;
  message?: string;
  data: PaginatedResponse<CertificateReprintRow>;
  counts?: ReprintStatusCounts;
  awaiting_count?: number;
}

export const reprintsAPI = {
  getFee: () => api.get<ApiResponse<ReprintFeeSetting>>('/admin/certificates/reprint-fee'),

  updateFee: (amount: number) =>
    api.put<ApiResponse<ReprintFeeSetting>>('/admin/certificates/reprint-fee', { amount }),

  list: (params: { status?: ReprintStatus | 'all'; search?: string; page?: number; per_page?: number }) =>
    api.get<ReprintListResponse>('/admin/certificates/reprints', { params }),

  request: (issuedCertificateId: number, reason?: string) =>
    api.post<ApiResponse<CertificateReprintRow>>(`/admin/certificates/issued/${issuedCertificateId}/reprint`, {
      reason: reason || undefined,
    }),

  release: (reprintId: number) =>
    api.post<ApiResponse<CertificateReprintRow>>(`/admin/certificates/reprints/${reprintId}/release`),

  cancel: (reprintId: number, reason: string) =>
    api.post<ApiResponse<CertificateReprintRow>>(`/admin/certificates/reprints/${reprintId}/cancel`, { reason }),

  cashierList: (params: { view?: 'awaiting' | 'history'; search?: string; page?: number; per_page?: number }) =>
    api.get<ReprintListResponse>('/admin/cashier/certificate-reprints', { params }),

  markPaid: (reprintId: number, data: { or_number?: string; notes?: string }) =>
    api.post<ApiResponse<CertificateReprintRow>>(`/admin/cashier/certificate-reprints/${reprintId}/pay`, data),
};
