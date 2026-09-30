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
