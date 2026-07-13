import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';

// ============ TYPE DEFINITIONS ============

export interface ChurchService {
    service_id: number;
    service_name: string;
    fee: number;
    created_at?: string;
    updated_at?: string;
    formatted_fee?: string;
    form_type?: 'baptism' | 'service' | 'certificate' | null;
    required_form?: string | null;
    is_baptism?: boolean;
    is_marriage?: boolean;
    is_certificate?: boolean;
    uses_service_form?: boolean;
}

export interface ChurchServiceFilters {
    search?: string;
    type?: 'baptism' | 'certificate' | 'service_form';
    per_page?: number;
}

export interface ChurchServiceStatistics {
    total_services: number;
    fee_statistics: {
        min: number;
        max: number;
        average: number;
    };
    most_requested: ChurchService[];
    all_services_with_counts: ChurchService[];
}

export interface ServiceOptions {
    all: ChurchService[];
    grouped: {
        baptism: ChurchService | null;
        service_form: ChurchService[];
        certificate: ChurchService[];
    };
}

export interface CreateChurchServiceData {
    service_name: string;
    fee: number;
}

export interface UpdateChurchServiceData {
    service_name?: string;
    fee?: number;
}

// ============ CHURCH SERVICE API ============

export const churchServiceAPI = {
    /**
     * Get all church services with optional filters
     */
    getAll: (filters?: ChurchServiceFilters) => 
        api.get<ApiResponse<PaginatedResponse<ChurchService>>>('/church-services', { params: filters }),

    /**
     * Get service options for dropdowns 
     */
    getOptions: () => 
        api.get<ApiResponse<ServiceOptions>>('/church-services/options'),

    /**
     * Get a specific service by ID
     */
    getById: (id: number) => 
        api.get<ApiResponse<ChurchService>>(`/church-services/${id}`),

    /**
     * Get service by name
     */
    getByName: (name: string) => 
        api.get<ApiResponse<ChurchService>>(`/church-services/name/${name}`),

    /**
     * Get service statistics
     */
    getStatistics: () => 
        api.get<ApiResponse<ChurchServiceStatistics>>('/church-services/statistics'),

    /**
     * Create a new church service (Admin only)
     */
    create: (data: CreateChurchServiceData) => 
        api.post<ApiResponse<ChurchService>>('/church-services', data),

    /**
     * Update a church service
     */
    update: (id: number, data: UpdateChurchServiceData) => 
        api.put<ApiResponse<ChurchService>>(`/church-services/${id}`, data),

    /**
     * Delete a church service
     */
    delete: (id: number) => 
        api.delete<ApiResponse<null>>(`/church-services/${id}`),
};

// ============ HELPER FUNCTIONS ============

/**
 * Format fee for display
 */
export const formatFee = (fee: number): string => {
    return `₱${fee.toFixed(2)}`;
};

/**
 * Get service name by ID
 */
export const getServiceName = (services: ChurchService[], id: number): string => {
    const service = services.find(s => s.service_id === id);
    return service?.service_name || 'Unknown Service';
};

/**
 * Get service fee by ID
 */
export const getServiceFee = (services: ChurchService[], id: number): number => {
    const service = services.find(s => s.service_id === id);
    return service?.fee || 0;
};

/**
 * Get service by ID
 */
export const getServiceById = (services: ChurchService[], id: number): ChurchService | undefined => {
    return services.find(s => s.service_id === id);
};

/**
 * Get service options for select dropdown
 */
export const getServiceSelectOptions = (services: ChurchService[]) => {
    return services.map(service => ({
        value: service.service_id,
        label: `${service.service_name} (${formatFee(service.fee)})`,
        fee: service.fee,
        name: service.service_name,
    }));
};

/**
 * Group services by type
 */
export const groupServicesByType = (services: ChurchService[]) => {
    const grouped: Record<string, ChurchService[]> = {
        baptism: [],
        service_form: [],
        certificate: [],
    };

    services.forEach(service => {
        if (service.service_name === 'Baptism') {
            grouped.baptism.push(service);
        } else if (['Marriage', 'Funeral Mass', 'House Blessing'].includes(service.service_name)) {
            grouped.service_form.push(service);
        } else if (['Baptismal Certificate', 'Marriage Certificate'].includes(service.service_name)) {
            grouped.certificate.push(service);
        }
    });

    return grouped;
};

/**
 * Get services by type
 */
export const getServicesByType = (services: ChurchService[], type: 'baptism' | 'service_form' | 'certificate'): ChurchService[] => {
    const grouped = groupServicesByType(services);
    return grouped[type] || [];
};

/**
 * Get services for a specific form type
 */
export const getServicesForFormType = (services: ChurchService[], formType: string): ChurchService[] => {
    if (formType === 'baptism') {
        return services.filter(s => s.service_name === 'Baptism');
    } else if (formType === 'service') {
        return services.filter(s => ['Marriage', 'Funeral Mass', 'House Blessing'].includes(s.service_name));
    } else if (formType === 'certificate') {
        return services.filter(s => ['Baptismal Certificate', 'Marriage Certificate'].includes(s.service_name));
    }
    return [];
};

/**
 * Get total fee for multiple services
 */
export const getTotalFee = (services: ChurchService[], ids: number[]): number => {
    return ids.reduce((total, id) => {
        const service = services.find(s => s.service_id === id);
        return total + (service?.fee || 0);
    }, 0);
};

/**
 * Check if service exists
 */
export const serviceExists = (services: ChurchService[], id: number): boolean => {
    return services.some(s => s.service_id === id);
};

/**
 * Get service count by type
 */
export const getServiceCountByType = (services: ChurchService[]): Record<string, number> => {
    const grouped = groupServicesByType(services);
    return {
        baptism: grouped.baptism.length,
        service_form: grouped.service_form.length,
        certificate: grouped.certificate.length,
        total: services.length,
    };
};

/**
 * Get form type from service name
 */
export const getFormTypeFromService = (serviceName: string): 'baptism' | 'service' | 'certificate' | null => {
    if (serviceName === 'Baptism') return 'baptism';
    if (['Marriage', 'Funeral Mass', 'House Blessing'].includes(serviceName)) return 'service';
    if (['Baptismal Certificate', 'Marriage Certificate'].includes(serviceName)) return 'certificate';
    return null;
};

/**
 * Check if service requires a specific form
 */
export const getRequiredFormForService = (serviceName: string): string => {
    const forms: Record<string, string> = {
        'Baptism': 'baptism_form',
        'Marriage': 'service_form',
        'Funeral Mass': 'service_form',
        'House Blessing': 'service_form',
        'Baptismal Certificate': 'certificate_form',
        'Marriage Certificate': 'certificate_form',
    };
    return forms[serviceName] || 'unknown';
};

/**
 * Get service fee with currency
 */
export const getServiceFeeWithCurrency = (fee: number): string => {
    return `₱${fee.toFixed(2)}`;
};