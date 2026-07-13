import { api } from './api';
import type { User, ApiResponse, PaginatedResponse } from './api';
import type { ChurchService } from './church_service';

// ============ TYPE DEFINITIONS ============
export type FormType = 'baptism' | 'service' | 'certificate';
export type RequestStatus = 'pending' | 'approved' | 'done' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

// ============ BAPTISM TYPES ============
export interface BaptismGodparent {
    name: string;
    type: 'godfather' | 'godmother';
}

export interface BaptismDetails {
    child_name: string;
    date_of_birth: string;
    place_of_birth: string;
    father_name: string;
    mother_name: string;
    address: string;
    contact_no: string;
    baptism_date: string;
    godparents: BaptismGodparent[];
}

export interface BaptismForm {
    baptism_id: number;
    child_first_name: string;
    child_middle_name?: string | null;
    child_last_name: string;
    child_birth_date: string;
    child_birth_place?: string | null;
    mother_first_name: string;
    mother_middle_name?: string | null;
    mother_last_name: string;
    father_first_name: string;
    father_middle_name?: string | null;
    father_last_name: string;
    address: string;
    contact_number: string;
    preferred_date?: string;
    preferred_time?: string;
    created_at?: string;
    updated_at?: string;
    full_name?: string;
    details?: BaptismDetails;
    godparents?: BaptismGodparent[];
}

// ============ FUNERAL MASS TYPES ============
export interface FuneralMassDetails {
    deceased_name: string;
    address: string;
    funeral_date: string;
    time: string;
    contact_no: string;
}

// ============ HOUSE BLESSING TYPES ============
export interface HouseBlessingDetails {
    requester_name: string;
    address: string;
    contact_no: string;
}

// ============ MARRIAGE TYPES ============
export interface MarriageDetails {
    contact_no?: string;
}

export interface ServiceForm {
    serviceform_id: number;
    service_name?: string;
    full_name: string;
    time?: string;
    address: string;
    contact_number: string;
    preferred_date?: string;
    preferred_time?: string;
    created_at?: string;
    updated_at?: string;
    service_fee?: number;
    full_name_with_time?: string;
    details?: FuneralMassDetails | HouseBlessingDetails | MarriageDetails;
}

export interface CertificateForm {
    certificate_id: number;
    full_name: string;
    birth_date?: string | null;
    marriage_date?: string | null;
    address: string;
    contact_number: string;
    certificate_type: 'baptismal' | 'marriage';
    preferred_date?: string;
    preferred_time?: string;
    created_at?: string;
    updated_at?: string;
    certificate_type_label?: string;
    certificate_display_name?: string;
    service_name?: string;
    service_fee?: number;
    full_name_with_type?: string;
}

// ============ ADMIN REQUEST TYPES ============
export interface AdminBaptismItem {
    id: number;
    service_type: string;
    requester_name: string;
    preferred_date: string;
    preferred_time?: string;
    contact_no: string;
    status: RequestStatus;
    created_at: string;
    details: BaptismDetails;
}

export interface AdminFuneralItem {
    id: number;
    service_type: string;
    requester_name: string;
    preferred_date: string;
    preferred_time?: string;
    contact_no: string;
    status: RequestStatus;
    created_at: string;
    details: FuneralMassDetails;
}

export interface AdminHouseBlessingItem {
    id: number;
    service_type: string;
    requester_name: string;
    preferred_date: string;
    preferred_time?: string;
    contact_no: string;
    status: RequestStatus;
    created_at: string;
    details: HouseBlessingDetails;
}

export interface AdminMarriageItem {
    id: number;
    couple_names: string;
    address?: string;
    contact_no?: string;
    preferred_date?: string;
    preferred_time?: string;
    status: RequestStatus;
    created_at?: string;
    details?: MarriageDetails;
}

export interface BaptismRequest {
    id: number;
    service_type: string;
    requester_name: string;
    preferred_date: string;
    preferred_time?: string;
    contact_no?: string;
    status: RequestStatus;
    created_at: string;
    details?: BaptismDetails;
}

export interface FuneralMassRequest {
    id: number;
    service_type: string;
    requester_name: string;
    preferred_date: string;
    preferred_time?: string;
    contact_no?: string;
    status: RequestStatus;
    created_at: string;
    details?: FuneralMassDetails;
}

export interface HouseBlessingRequest {
    id: number;
    service_type: string;
    requester_name: string;
    preferred_date: string;
    preferred_time?: string;
    contact_no?: string;
    status: RequestStatus;
    created_at: string;
    details?: HouseBlessingDetails;
}

export interface MarriageInquiry {
    id: number;
    service_type: string;
    requester_name: string;
    couple_names: string;
    address?: string;
    preferred_date: string;
    preferred_time?: string;
    contact_no?: string;
    status: RequestStatus;
    created_at: string;
    details?: MarriageDetails;
}

// ============ MAIN MANAGE REQUEST INTERFACE ============
export interface ManageRequest {
    request_id: number;
    user_id: number;
    service_id: number;
    processed_by?: number | null;
    assigned_priest?: number | null;

    baptism_form_id?: number | null;
    service_form_id?: number | null;
    certificate_form_id?: number | null;

    preferred_date: string;
    preferred_time: string;
    status: RequestStatus;
    cancelled_by?: number | null;
    cancelled_reason?: string | null;

    rescheduled_by?: number | null;
    reschedule_reason?: string | null;
    can_be_rescheduled?: boolean;
    reschedule_count?: number;

    payment_status: PaymentStatus;
    amount_paid: number;
    payment_date?: string | null;
    approved_at?: string | null;
    completed_at?: string | null;
    created_at: string;
    updated_at: string;

    // Relationships
    user?: User;
    service?: ChurchService;
    processedBy?: User;
    assignedPriest?: User;
    cancelledBy?: User;
    rescheduledBy?: User;

    baptismForm?: BaptismForm;
    serviceForm?: ServiceForm;
    certificateForm?: CertificateForm;

    // Computed attributes
    form_type?: FormType | null;
    form_type_label?: string;
    form_summary?: string;
    status_color?: string;
    payment_status_color?: string;
    remaining_balance?: number;
    is_fully_paid?: boolean;
    formatted_preferred_date?: string;
    formatted_preferred_time?: string;
}

// ============ CREATE/UPDATE DATA TYPES ============
export interface CreateManageRequestData {
    user_id: number;
    service_id: number;
    baptism_form_id?: number | null;
    service_form_id?: number | null;
    certificate_form_id?: number | null;
}

export interface UpdateManageRequestData {
    user_id?: number;
    service_id?: number;
    assigned_priest?: number | null;
    baptism_form_id?: number | null;
    service_form_id?: number | null;
    certificate_form_id?: number | null;
}

export interface RescheduleData {
    preferred_date: string;
    preferred_time: string;
    reschedule_reason: string;
}

export interface ManageRequestFilters {
    status?: RequestStatus | 'all';
    payment_status?: PaymentStatus | 'all';
    form_type?: FormType | 'all';
    date_from?: string;
    date_to?: string;
    search?: string;
    per_page?: number;
    page?: number;
}

export interface PaymentData {
    amount: number;
}

export interface CancelData {
    cancelled_reason: string;
}

// ============ TRANSFORMER FUNCTIONS ============

export const toBaptismRequest = (item: AdminBaptismItem): BaptismRequest => ({
    id: item.id,
    service_type: item.service_type || 'baptism',
    requester_name: item.requester_name || item.details?.child_name || 'N/A',
    preferred_date: item.preferred_date || item.details?.baptism_date || '',
    preferred_time: item.preferred_time || '',
    contact_no: item.contact_no || item.details?.contact_no || '',
    status: item.status || 'pending',
    created_at: item.created_at || new Date().toISOString(),
    details: item.details
});

export const toFuneralMassRequest = (item: AdminFuneralItem): FuneralMassRequest => ({
    id: item.id,
    service_type: item.service_type || 'funeral_mass',
    requester_name: item.requester_name || item.details?.deceased_name || 'N/A',
    preferred_date: item.preferred_date || item.details?.funeral_date || '',
    preferred_time: item.preferred_time || item.details?.time || '',
    contact_no: item.contact_no || item.details?.contact_no || '',
    status: item.status || 'pending',
    created_at: item.created_at || new Date().toISOString(),
    details: item.details
});

export const toHouseBlessingRequest = (item: AdminHouseBlessingItem): HouseBlessingRequest => ({
    id: item.id,
    service_type: item.service_type || 'house_blessing',
    requester_name: item.requester_name || item.details?.requester_name || 'N/A',
    preferred_date: item.preferred_date || '',
    preferred_time: item.preferred_time || '',
    contact_no: item.contact_no || item.details?.contact_no || '',
    status: item.status || 'pending',
    created_at: item.created_at || new Date().toISOString(),
    details: item.details
});

export const toMarriageInquiry = (item: AdminMarriageItem): MarriageInquiry => ({
    id: item.id,
    service_type: 'marriage',
    requester_name: item.couple_names || 'N/A',
    couple_names: item.couple_names || 'N/A',
    address: item.address || '',
    preferred_date: item.preferred_date || '',
    preferred_time: item.preferred_time || '',
    contact_no: item.contact_no || item.details?.contact_no || '',
    status: item.status || 'pending',
    created_at: item.created_at || new Date().toISOString(),
    details: item.details
});

// ============ HELPER FUNCTIONS ============

export const getStatusColor = (status: RequestStatus): string => {
    const colors: Record<RequestStatus, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        approved: 'bg-green-100 text-green-800',
        done: 'bg-purple-100 text-purple-800',
        cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getStatusLabel = (status: RequestStatus): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
};

export const hasBaptismForm = (request: ManageRequest): boolean => {
    return !!request.baptism_form_id;
};

export const hasServiceForm = (request: ManageRequest): boolean => {
    return !!request.service_form_id;
};

export const hasCertificateForm = (request: ManageRequest): boolean => {
    return !!request.certificate_form_id;
};

export const getFormType = (request: ManageRequest): FormType | null => {
    if (request.baptism_form_id) return 'baptism';
    if (request.service_form_id) return 'service';
    if (request.certificate_form_id) return 'certificate';
    return null;
};

export const getForm = (request: ManageRequest): BaptismForm | ServiceForm | CertificateForm | null => {
    if (request.baptism_form_id) return request.baptismForm || null;
    if (request.service_form_id) return request.serviceForm || null;
    if (request.certificate_form_id) return request.certificateForm || null;
    return null;
};

export const getFormSummary = (request: ManageRequest): string => {
    if (request.form_summary) return request.form_summary;

    const form = getForm(request);
    if (!form) return 'No form attached';

    if (request.baptism_form_id && request.baptismForm) {
        return `Baptism: ${request.baptismForm.child_first_name} ${request.baptismForm.child_last_name}`;
    }
    if (request.service_form_id && request.serviceForm) {
        return `Service: ${request.serviceForm.full_name}`;
    }
    if (request.certificate_form_id && request.certificateForm) {
        return `${request.certificateForm.certificate_type_label} Certificate: ${request.certificateForm.full_name}`;
    }
    return 'Unknown Form';
};

export const canBeRescheduled = (request: ManageRequest): boolean => {
    return request.can_be_rescheduled ?? false;
};

export const getRescheduleInfo = (request: ManageRequest): string => {
    if (!request.rescheduled_by) return 'Never rescheduled';
    const userName = request.rescheduledBy?.first_name
        ? `${request.rescheduledBy.first_name} ${request.rescheduledBy.last_name || ''}`.trim()
        : 'User';
    return `Rescheduled by ${userName} on ${new Date(request.updated_at).toLocaleDateString()}`;
};

export const getUserFullName = (user: User | undefined | null): string => {
    if (!user) return 'N/A';
    if (user.full_name) return user.full_name;
    if (user.first_name) {
        const middle = user.middle_name ? ` ${user.middle_name}` : '';
        return `${user.first_name}${middle} ${user.last_name}`;
    }
    return 'N/A';
};

// ============ MANAGE REQUEST API ============

export const manageRequestAPI = {
    // ============ REQUEST MANAGEMENT - ADMIN ENDPOINTS ============

    /**
     * Get all requests with filters - ADMIN VERSION
     */
    getAll: (filters?: ManageRequestFilters) =>
        api.get<ApiResponse<PaginatedResponse<ManageRequest>>>('/admin/requests', { params: filters }),

    /**
     * Get a single request by ID - ADMIN VERSION
     */
    getById: (id: number) =>
        api.get<ApiResponse<ManageRequest>>(`/admin/requests/${id}`),

    /**
     * Create a new request
     */
    create: (data: CreateManageRequestData) =>
        api.post<ApiResponse<ManageRequest>>('/manage-requests', data),

    /**
     * Update a request
     */
    update: (id: number, data: UpdateManageRequestData) =>
        api.put<ApiResponse<ManageRequest>>(`/manage-requests/${id}`, data),

    /**
     * Delete a request
     */
    delete: (id: number) =>
        api.delete<ApiResponse<null>>(`/manage-requests/${id}`),

    /**
     * Approve a request (pending → approved) - ADMIN VERSION
     */
    approve: (id: number) =>
        api.post<ApiResponse<ManageRequest>>(`/admin/requests/${id}/approve`),

    /**
     * Complete a request (approved → done) - ADMIN VERSION
     */
    complete: (id: number) =>
        api.post<ApiResponse<ManageRequest>>(`/admin/requests/${id}/complete`),

    /**
     * Cancel a request - ADMIN VERSION
     */
    cancel: (id: number, data: CancelData) =>
        api.post<ApiResponse<ManageRequest>>(`/admin/requests/${id}/cancel`, data),

    /**
     * Record a payment for a request - ADMIN VERSION
     */
    pay: (id: number, data: PaymentData) =>
        api.post<ApiResponse<ManageRequest>>(`/admin/requests/${id}/pay`, data),

    /**
     * Reschedule a request - ADMIN VERSION
     */
    reschedule: (id: number, data: RescheduleData) =>
        api.post<ApiResponse<ManageRequest>>(`/admin/requests/${id}/reschedule`, data),

    /**
     * Get form details for AJAX request - ADMIN VERSION
     */
    getFormDetails: (formType: FormType, formId: number) =>
        api.get<ApiResponse<{ form: BaptismForm | ServiceForm | CertificateForm; form_type_label: string }>>(
            '/admin/requests/form-details',
            { params: { form_type: formType, form_id: formId } }
        ),

    /**
     * Export requests to CSV - ADMIN VERSION
     */
    export: (filters?: ManageRequestFilters) =>
        api.get<Blob>('/admin/requests/export', {
            params: filters,
            responseType: 'blob'
        }),

    // ============ BAPTISM ============

    /**
     * Get all processed baptisms for admin
     */
    getProcessedBaptisms: () =>
        api.get<ApiResponse<{ data: AdminBaptismItem[] }>>('/admin/baptisms/processed'),

    /**
     * Get baptism details with godparents
     */
    getBaptismDetails: (id: number) =>
        api.get<ApiResponse<AdminBaptismItem>>(`/admin/baptisms/${id}`),

    /**
     * Update baptism status
     */
    updateBaptismStatus: (id: number, status: RequestStatus) =>
        api.put<ApiResponse<{ success: boolean; message: string }>>(
            `/admin/baptisms/${id}/status`,
            { status }
        ),

    // ============ FUNERAL MASS ============

    /**
     * Get all processed funeral masses for admin
     */
    getProcessedFuneralMasses: () =>
        api.get<ApiResponse<{ data: AdminFuneralItem[] }>>('/admin/funeral-masses/processed'),

    /**
     * Update funeral mass status
     */
    updateFuneralMassStatus: (id: number, status: RequestStatus) =>
        api.put<ApiResponse<{ success: boolean; message: string }>>(
            `/admin/funeral-masses/${id}/status`,
            { status }
        ),

    // ============ HOUSE BLESSINGS ============

    /**
     * Get all house blessings for admin
     */
    getHouseBlessings: () =>
        api.get<ApiResponse<{ data: AdminHouseBlessingItem[] }>>('/admin/house-blessings'),

    /**
     * Update house blessing status
     */
    updateHouseBlessingStatus: (id: number, status: RequestStatus) =>
        api.put<ApiResponse<{ success: boolean; message: string }>>(
            `/admin/house-blessings/${id}/status`,
            { status }
        ),

    // ============ MARRIAGE ============

    /**
     * Get all processed marriages for admin
     */
    getProcessedMarriages: () =>
        api.get<ApiResponse<{ data: AdminMarriageItem[] }>>('/admin/marriages/processed'),

    /**
     * Update marriage status
     */
    updateMarriageStatus: (id: number, status: RequestStatus) =>
        api.put<ApiResponse<{ success: boolean; message: string }>>(
            `/admin/marriages/${id}/status`,
            { status }
        ),

    // ============ PRIEST METHODS ============

    /**
     * Get assigned requests for priest
     */
    getAssignedRequests: (filters?: ManageRequestFilters) =>
        api.get<ApiResponse<PaginatedResponse<ManageRequest>>>('/priest/assigned-requests', { params: filters }),

    /**
     * Update request status for priest
     */
    updateRequestStatus: (id: number, data: { status: RequestStatus, reason?: string }) =>
        api.put<ApiResponse<ManageRequest>>(`/priest/requests/${id}/status`, data),

    /**
 * Assign a priest to a request - ADMIN VERSION
 */
    assignPriest: (id: number, priestId: number) =>
        api.post<ApiResponse<ManageRequest>>(`/admin/requests/${id}/assign-priest`, { priest_id: priestId }),
};