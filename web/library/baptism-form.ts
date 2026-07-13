import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';
import type { ManageRequest } from './manage-request';

// ============ TYPE DEFINITIONS ============
export interface BaptismGodparent {
    godparent_id: number;
    baptism_id: number;
    godparent_name: string;
    relationship: 'godfather' | 'godmother';
    created_at?: string;
    updated_at?: string;
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
    preferred_date: string;
    preferred_time: string;
    created_at?: string;
    updated_at?: string;
    request?: ManageRequest;
    godparents?: BaptismGodparent[];
    full_name?: string;
    formatted_preferred_date?: string;
    formatted_preferred_time?: string;
}

export interface CreateBaptismFormData {
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
    preferred_date: string;
    preferred_time: string;
}

export type UpdateBaptismFormData = Partial<CreateBaptismFormData>;

export interface CreateGodparentData {
    godparent_name: string;
    relationship: 'godfather' | 'godmother';
}

export interface BulkCreateGodparentsData {
    godparents: CreateGodparentData[];
}

export interface BaptismFormFilters {
    search?: string;
    from_date?: string;
    to_date?: string;
    preferred_from_date?: string;
    preferred_to_date?: string;
    per_page?: number;
}

export interface GodparentsResponse {
    godfathers: BaptismGodparent[];
    godmothers: BaptismGodparent[];
    total: number;
}

export interface BaptismStatistics {
    total_baptism_forms: number;
    with_requests: number;
    without_requests: number;
    recent_requests: BaptismForm[];
}

// ============ BAPTISM FORM API ============
export const baptismFormAPI = {
    getAll: (filters?: BaptismFormFilters) => 
        api.get<ApiResponse<PaginatedResponse<BaptismForm>>>('/baptism-forms', { params: filters }),

    getById: (id: number) => 
        api.get<ApiResponse<BaptismForm>>(`/baptism-forms/${id}`),

    create: (formData: CreateBaptismFormData) => 
        api.post<ApiResponse<BaptismForm>>('/baptism-forms', formData),

    update: (id: number, formData: UpdateBaptismFormData) => 
        api.put<ApiResponse<BaptismForm>>(`/baptism-forms/${id}`, formData),

    delete: (id: number) => 
        api.delete<ApiResponse<null>>(`/baptism-forms/${id}`),

    getStatistics: () => 
        api.get<ApiResponse<BaptismStatistics>>('/baptism-forms/statistics'),

    getGodparents: (baptismId: number) => 
        api.get<ApiResponse<GodparentsResponse>>(`/baptism-forms/${baptismId}/godparents`),

    addGodparent: (baptismId: number, godparentData: CreateGodparentData) => 
        api.post<ApiResponse<BaptismGodparent>>(`/baptism-forms/${baptismId}/godparents`, godparentData),

    removeGodparent: (baptismId: number, godparentId: number) => 
        api.delete<ApiResponse<null>>(`/baptism-forms/${baptismId}/godparents/${godparentId}`),

    bulkAddGodparents: (baptismId: number, bulkData: BulkCreateGodparentsData) => 
        api.post<ApiResponse<BaptismGodparent[]>>(`/baptism-forms/${baptismId}/godparents/bulk`, bulkData),

    /**
     * Get baptism forms by preferred date range
     */
    getByPreferredDate: (fromDate: string, toDate: string, perPage?: number) => 
        api.get<ApiResponse<PaginatedResponse<BaptismForm>>>('/baptism-forms/by-preferred-date', {
            params: { 
                from_date: fromDate, 
                to_date: toDate, 
                per_page: perPage 
            }
        }),

    /**
     * Get upcoming baptism forms
     */
    getUpcoming: (perPage?: number) => 
        api.get<ApiResponse<PaginatedResponse<BaptismForm>>>('/baptism-forms/upcoming', {
            params: { per_page: perPage }
        }),
};

// ============ HELPER FUNCTIONS ============

/**
 * Format preferred date for display
 */
export const formatPreferredDate = (date: string): string => {
    if (!date) {
        return '';
    }
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
    if (!time) {
        return '';
    }
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

/**
 * Get full name of the child
 */
export const getChildFullName = (form: BaptismForm): string => {
    const middle = form.child_middle_name ? ` ${form.child_middle_name}` : '';
    return `${form.child_first_name}${middle} ${form.child_last_name}`;
};

/**
 * Check if baptism form is upcoming
 */
export const isUpcoming = (form: BaptismForm): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const preferredDate = new Date(form.preferred_date);
    preferredDate.setHours(0, 0, 0, 0);
    return preferredDate >= today;
};

/**
 * Check if baptism form is today
 */
export const isToday = (form: BaptismForm): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const preferredDate = new Date(form.preferred_date);
    preferredDate.setHours(0, 0, 0, 0);
    return preferredDate.getTime() === today.getTime();
};

/**
 * Get the full name with preferred date
 */
export const getFormSummary = (form: BaptismForm): string => {
    const childName = getChildFullName(form);
    const date = formatPreferredDate(form.preferred_date);
    const time = formatPreferredTime(form.preferred_time);
    return `${childName} - ${date} at ${time}`;
};