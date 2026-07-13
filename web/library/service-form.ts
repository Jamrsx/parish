import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';
import type { ManageRequest } from './manage-request';

// ============ TYPE DEFINITIONS ============

export interface ServiceForm {
    serviceform_id: number;
    service_name: string;
    full_name: string;
    address: string;
    contact_number: string;
    preferred_date: string;
    preferred_time: string;
    created_at?: string;
    updated_at?: string;
    request?: ManageRequest;
    service_fee?: number;
    formatted_fee?: string;
    formatted_time?: string;
    formatted_preferred_date?: string;
    formatted_preferred_time?: string;
    full_name_with_time?: string;
    church_service?: {
        service_id: number;
        service_name: string;
        fee: number;
        formatted_fee: string;
    };
}

export interface CreateServiceFormData {
    service_name: string;
    full_name: string;
    address: string;
    contact_number: string;
    preferred_date: string;
    preferred_time: string;
}

export type UpdateServiceFormData = Partial<CreateServiceFormData>;

export interface ServiceFormFilters {
    service_name?: string;
    service_type?: string;
    status?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    preferred_from_date?: string;
    preferred_to_date?: string;
    per_page?: number;
}

export interface AvailableService {
    service_id: number;
    service_name: string;
    fee: number;
    formatted_fee: string;
}

export interface ServiceFormStatistics {
    total: number;
    with_requests: number;
    without_requests: number;
    by_service: Array<{
        service_name: string;
        total: number;
        fee: number;
        formatted_fee: string;
    }>;
    by_status: {
        pending: number;
        approved: number;
        done: number;
        cancelled: number;
    };
    recent: ServiceForm[];
}

// ============ SERVICE FORM API ============

export const serviceFormAPI = {
    /**
     * Get all service forms with optional filters
     */
    getAll: (filters?: ServiceFormFilters) => 
        api.get<ApiResponse<PaginatedResponse<ServiceForm>>>('/service-forms', { params: filters }),

    /**
     * Get a specific service form by ID
     */
    getById: (id: number) => 
        api.get<ApiResponse<ServiceForm>>(`/service-forms/${id}`),

    /**
     * Get available services for dropdown
     */
    getAvailableServices: () => 
        api.get<ApiResponse<AvailableService[]>>('/service-forms/available-services'),

    /**
     * Create a new service form - ✅ Uses service_id from the service
     */
    create: (data: CreateServiceFormData) => 
        api.post<ApiResponse<ServiceForm>>('/service-forms', data),

    /**
     * Update a service form
     */
    update: (id: number, data: UpdateServiceFormData) => 
        api.put<ApiResponse<ServiceForm>>(`/service-forms/${id}`, data),

    /**
     * Delete a service form
     */
    delete: (id: number) => 
        api.delete<ApiResponse<null>>(`/service-forms/${id}`),

    /**
     * Get service form statistics
     */
    getStats: () => 
        api.get<ApiResponse<ServiceFormStatistics>>('/service-forms/stats'),

    /**
     * Get upcoming service forms
     */
    getUpcoming: () => 
        api.get<ApiResponse<ServiceForm[]>>('/service-forms/upcoming'),

    /**
     * Search service forms
     */
    search: (query: string) => 
        api.get<ApiResponse<ServiceForm[]>>('/service-forms/search', { params: { query } }),

    /**
     * Get forms by service name
     */
    getByServiceName: (serviceName: string) => 
        api.get<ApiResponse<ServiceForm[]>>(`/service-forms/by-service/${serviceName}`),

    /**
     * Get forms by service type
     */
    getByServiceType: (serviceType: string) => 
        api.get<ApiResponse<ServiceForm[]>>(`/service-forms/by-type/${serviceType}`),

    /**
     * Get forms by date range
     */
    getByDateRange: (startDate: string, endDate: string) => 
        api.post<ApiResponse<ServiceForm[]>>('/service-forms/date-range', {
            start_date: startDate,
            end_date: endDate
        }),

    /**
     * Get forms by preferred date range
     */
    getByPreferredDate: (fromDate: string, toDate: string, perPage?: number) => 
        api.get<ApiResponse<PaginatedResponse<ServiceForm>>>('/service-forms/by-preferred-date', {
            params: { from_date: fromDate, to_date: toDate, per_page: perPage }
        }),

    /**
     * Export service forms
     */
    export: (filters?: ServiceFormFilters) => 
        api.get<Blob>('/service-forms/export', { 
            params: filters,
            responseType: 'blob'
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
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
};

/**
 * Get service name from available services
 */
export const getServiceName = (services: AvailableService[], id: number): string => {
    const service = services.find(s => s.service_id === id);
    return service?.service_name || 'Unknown Service';
};

/**
 * Get service fee from available services
 */
export const getServiceFee = (services: AvailableService[], id: number): number => {
    const service = services.find(s => s.service_id === id);
    return service?.fee || 0;
};

/**
 * Get service by ID
 */
export const getServiceById = (services: AvailableService[], id: number): AvailableService | undefined => {
    return services.find(s => s.service_id === id);
};

/**
 * Get full name with service
 */
export const getFullNameWithService = (form: ServiceForm): string => {
    return `${form.full_name} - ${form.service_name}`;
};