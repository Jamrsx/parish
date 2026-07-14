import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';

export interface ChurchService {
    service_id: number;
    service_type?: string;
    service_name: string;
    description?: string | null;
    icon?: string | null;
    category?: 'service' | 'certificate';
    form_handler?: string;
    fee: number;
    available_slots?: number;
    is_active?: boolean;
    is_system?: boolean;
    created_at?: string;
    updated_at?: string;
    formatted_fee?: string;
    form_type?: 'baptism' | 'service' | 'certificate' | 'special_intention' | null;
    required_form?: string | null;
    is_baptism?: boolean;
    is_marriage?: boolean;
    is_certificate?: boolean;
    uses_service_form?: boolean;
    daily_limit?: number;
    today_bookings?: number;
    today_remaining?: number;
    navigate_path?: string;
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
    service_type: string;
    description?: string;
    icon?: string;
    category: 'service' | 'certificate';
    fee: number;
    available_slots: number;
    is_active?: boolean;
}

export interface UpdateChurchServiceData {
    service_type?: string;
    description?: string;
    icon?: string;
    category?: 'service' | 'certificate';
    fee?: number;
    available_slots?: number;
    is_active?: boolean;
}

export const churchServiceAPI = {
    getAll: (filters?: ChurchServiceFilters) =>
        api.get<ApiResponse<PaginatedResponse<ChurchService>>>('/church-services', { params: filters }),

    getAdminAll: (filters?: ChurchServiceFilters & { per_page?: number }) =>
        api.get<ApiResponse<PaginatedResponse<ChurchService>>>('/admin/church-services', {
            params: { per_page: 100, ...filters },
        }),

    getOptions: () => api.get<ApiResponse<ServiceOptions>>('/church-services/options'),

    getById: (id: number) => api.get<ApiResponse<ChurchService>>(`/church-services/${id}`),

    getByName: (name: string) => api.get<ApiResponse<ChurchService>>(`/church-services/name/${name}`),

    getStatistics: () =>
        api.get<ApiResponse<ChurchServiceStatistics>>('/church-services/statistics'),

    create: (data: CreateChurchServiceData) =>
        api.post<ApiResponse<ChurchService>>('/admin/church-services', data),

    update: (id: number, data: UpdateChurchServiceData) =>
        api.put<ApiResponse<ChurchService>>(`/admin/church-services/${id}`, data),

    delete: (id: number) => api.delete<ApiResponse<ChurchService | null>>(`/admin/church-services/${id}`),
};

export const formatFee = (fee: number): string => {
    return `₱${Number(fee || 0).toFixed(2)}`;
};

export const getServiceName = (services: ChurchService[], id: number): string => {
    const service = services.find((s) => s.service_id === id);
    return service?.service_name || service?.service_type || 'Unknown';
};

export const getServiceFee = (services: ChurchService[], id: number): number => {
    return services.find((s) => s.service_id === id)?.fee || 0;
};

export const getServiceById = (services: ChurchService[], id: number): ChurchService | undefined => {
    return services.find((s) => s.service_id === id);
};

export const getServiceSelectOptions = (services: ChurchService[]) => {
    return services.map((s) => ({
        value: s.service_id,
        label: s.service_name || s.service_type || '',
        fee: s.fee,
    }));
};

export const groupServicesByType = (services: ChurchService[]) => {
    const grouped: Record<string, ChurchService[]> = {
        baptism: [],
        service_form: [],
        certificate: [],
        other: [],
    };

    services.forEach((service) => {
        if (service.is_baptism) grouped.baptism.push(service);
        else if (service.is_certificate) grouped.certificate.push(service);
        else if (service.uses_service_form) grouped.service_form.push(service);
        else grouped.other.push(service);
    });

    return grouped;
};

export const getServicesByType = (
    services: ChurchService[],
    type: 'baptism' | 'service_form' | 'certificate'
): ChurchService[] => {
    if (type === 'baptism') return services.filter((s) => s.is_baptism);
    if (type === 'certificate') return services.filter((s) => s.is_certificate);
    return services.filter((s) => s.uses_service_form);
};

export const getServicesForFormType = (services: ChurchService[], formType: string): ChurchService[] => {
    if (formType === 'baptism') return getServicesByType(services, 'baptism');
    if (formType === 'certificate') return getServicesByType(services, 'certificate');
    return getServicesByType(services, 'service_form');
};

export const getTotalFee = (services: ChurchService[], ids: number[]): number => {
    return ids.reduce((sum, id) => sum + getServiceFee(services, id), 0);
};

export const serviceExists = (services: ChurchService[], id: number): boolean => {
    return services.some((s) => s.service_id === id);
};

export const getServiceCountByType = (services: ChurchService[]): Record<string, number> => {
    return {
        baptism: services.filter((s) => s.is_baptism).length,
        service_form: services.filter((s) => s.uses_service_form).length,
        certificate: services.filter((s) => s.is_certificate).length,
        total: services.length,
    };
};
