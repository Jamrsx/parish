import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';

// ============ TYPE DEFINITIONS ============
export interface Godparent {
    godparent_id: number;
    baptism_id: number;
    godparent_name: string;
    relationship: 'godfather' | 'godmother';
    created_at?: string;
    updated_at?: string;
}

export interface CreateGodparentData {
    baptism_id: number;
    godparent_name: string;
    relationship: 'godfather' | 'godmother';
}

export interface UpdateGodparentData {
    godparent_name?: string;
    relationship?: 'godfather' | 'godmother';
}

export interface BulkCreateGodparentsData {
    baptism_id: number;
    godparents: Array<{
        godparent_name: string;
        relationship: 'godfather' | 'godmother';
    }>;
}

export interface GodparentFilters {
    baptism_id?: number;
    relationship?: 'godfather' | 'godmother';
    per_page?: number;
}

export interface GodparentsResponse {
    godfathers: Godparent[];
    godmothers: Godparent[];
    total: number;
}

// ============ GODPARENT API ============
export const godparentAPI = {
    getAll: (filters?: GodparentFilters) => 
        api.get<ApiResponse<PaginatedResponse<Godparent>>>('/godparents', { params: filters }),

    getByBaptismForm: (baptismId: number) => 
        api.get<ApiResponse<GodparentsResponse>>(`/godparents/baptism/${baptismId}`),

    getById: (id: number) => 
        api.get<ApiResponse<Godparent>>(`/godparents/${id}`),

    create: (data: CreateGodparentData) => 
        api.post<ApiResponse<Godparent>>('/godparents', data),

    update: (id: number, data: UpdateGodparentData) => 
        api.put<ApiResponse<Godparent>>(`/godparents/${id}`, data),

    delete: (id: number) => 
        api.delete<ApiResponse<null>>(`/godparents/${id}`),

    bulkCreate: (data: BulkCreateGodparentsData) => 
        api.post<ApiResponse<Godparent[]>>('/godparents/bulk', data),
};