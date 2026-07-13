import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';
import type { ManageRequest } from './manage-request';
import type { ChurchService } from './church_service';

// ============ TYPE DEFINITIONS ============
export type CertificateType = 'baptismal' | 'marriage';

export interface CertificateForm {
    certificate_id: number;
    service_id: number;  // ✅ Changed from certificate_type to service_id
    full_name: string;
    birth_date?: string | null;
    marriage_date?: string | null;
    address: string;
    contact_number: string;
    preferred_date: string;
    preferred_time: string;
    created_at?: string;
    updated_at?: string;
    request?: ManageRequest;
    churchService?: ChurchService;  // ✅ Added relationship
    // Computed properties
    certificate_type?: CertificateType;  // ✅ Computed from churchService
    certificate_type_label?: string;
    certificate_display_name?: string;
    service_name?: string;
    service_fee?: number;
    full_name_with_type?: string;
    formatted_preferred_date?: string;
    formatted_preferred_time?: string;
}

export interface CreateCertificateFormData {
    service_id: number;  // ✅ Changed from certificate_type to service_id
    full_name: string;
    address: string;
    contact_number: string;
    birth_date?: string | null;
    marriage_date?: string | null;
    preferred_date: string;
    preferred_time: string;
}

export type UpdateCertificateFormData = Partial<CreateCertificateFormData>;

export interface CertificateFormFilters {
    service_id?: number;  // ✅ Changed from certificate_type to service_id
    service_type?: string;  // ✅ Added filter by service type name
    search?: string;
    from_date?: string;
    to_date?: string;
    preferred_from_date?: string;
    preferred_to_date?: string;
    per_page?: number;
}

export interface CertificateStatistics {
    total_certificates: number;
    baptismal_certificates: number;
    marriage_certificates: number;
    with_requests: number;
    without_requests: number;
    recent_requests: CertificateForm[];
}

// ============ CERTIFICATE FORM API ============
export const certificateFormAPI = {
    getAll: (filters?: CertificateFormFilters) => 
        api.get<ApiResponse<PaginatedResponse<CertificateForm>>>('/certificate-forms', { params: filters }),

    getById: (id: number) => 
        api.get<ApiResponse<CertificateForm>>(`/certificate-forms/${id}`),

    create: (data: CreateCertificateFormData) => 
        api.post<ApiResponse<CertificateForm>>('/certificate-forms', data),

    update: (id: number, data: UpdateCertificateFormData) => 
        api.put<ApiResponse<CertificateForm>>(`/certificate-forms/${id}`, data),

    delete: (id: number) => 
        api.delete<ApiResponse<null>>(`/certificate-forms/${id}`),

    getStatistics: () => 
        api.get<ApiResponse<CertificateStatistics>>('/certificate-forms/statistics'),

    /**
     * Get certificates by service type name
     */
    getByType: (type: string) => 
        api.get<ApiResponse<PaginatedResponse<CertificateForm>>>(`/certificate-forms/type/${type}`),

    search: (query: string) => 
        api.get<ApiResponse<CertificateForm[]>>('/certificate-forms/search', { params: { query } }),

    getByPreferredDate: (fromDate: string, toDate: string, perPage?: number) => 
        api.get<ApiResponse<PaginatedResponse<CertificateForm>>>('/certificate-forms/by-preferred-date', {
            params: { from_date: fromDate, to_date: toDate, per_page: perPage }
        }),

    getUpcoming: (perPage?: number) => 
        api.get<ApiResponse<PaginatedResponse<CertificateForm>>>('/certificate-forms/upcoming', {
            params: { per_page: perPage }
        }),
};

// ============ HELPER FUNCTIONS ============

/**
 * Format preferred date for display
 */
export const formatPreferredDate = (date: string): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

/**
 * Format preferred time for display (12-hour format)
 */
export const formatPreferredTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

/**
 * Get certificate display name
 */
export const getCertificateDisplayName = (form: CertificateForm): string => {
    const type = form.certificate_type === 'baptismal' ? 'Baptismal' : 'Marriage';
    return `${type} Certificate - ${form.full_name}`;
};

/**
 * Get certificate type from service name
 */
export const getCertificateTypeFromService = (serviceName: string): CertificateType | null => {
    if (serviceName === 'Baptismal Certificate') return 'baptismal';
    if (serviceName === 'Marriage Certificate') return 'marriage';
    return null;
};

/**
 * Get service ID for certificate type
 */
export const getServiceIdForCertificateType = (
    services: ChurchService[],
    type: CertificateType
): number | null => {
    const serviceName = type === 'baptismal' ? 'Baptismal Certificate' : 'Marriage Certificate';
    const service = services.find(s => s.service_name === serviceName);
    return service?.service_id || null;
};