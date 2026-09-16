import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';
import type { DailyReportData } from './cashier';
import type { InventoryItem } from './inventory';

export interface PriestServiceOption {
  service_id: number;
  service_type: string;
}

export interface PriestActivityShare {
  service_id?: number | null;
  service_type: string;
  request_count: number;
  completed_count: number;
  approved_count: number;
  cancelled_count: number;
  percentage: number;
}

export interface PriestMonthlyAssignment {
  request_id: number;
  service_id?: number | null;
  service_type: string;
  preferred_date?: string | null;
  preferred_time?: string | null;
  status: string;
  parishioner?: string | null;
}

export interface PriestMonthlyActivity {
  year: number;
  month: number;
  month_label: string;
  service_id?: number | null;
  period: { start: string; end: string };
  summary: {
    total_assigned: number;
    pending: number;
    approved: number;
    completed: number;
    cancelled: number;
  };
  activity_by_service: PriestActivityShare[];
  available_services: PriestServiceOption[];
  assignments: PriestMonthlyAssignment[];
}

/**
 * Priest read-only APIs — income and inventory viewing only.
 */
export const priestAPI = {
  getIncome: (date: string) => {
    console.log('Priest fetching income for:', date);
    return api.get<ApiResponse<DailyReportData>>('/priest/income', { params: { date } });
  },

  getMonthlyActivity: (params?: { year?: number; month?: number; service_id?: number | null }) => {
    console.log('Priest fetching monthly activity:', params);
    return api.get<ApiResponse<PriestMonthlyActivity>>('/priest/monthly-activity', {
      params: {
        year: params?.year,
        month: params?.month,
        service_id: params?.service_id || undefined,
      },
    });
  },

  getInventory: (params?: {
    search?: string;
    type?: 'item' | 'consumable';
    category?: string;
    is_borrowable?: boolean;
    per_page?: number;
    page?: number;
  }) => {
    console.log('Priest fetching inventory:', params);
    return api.get<ApiResponse<PaginatedResponse<InventoryItem>>>('/priest/inventory', { params });
  },

  getInventoryCategories: () =>
    api.get<ApiResponse<string[]>>('/priest/inventory/categories'),

  getInventoryItem: (id: number) =>
    api.get<ApiResponse<InventoryItem>>(`/priest/inventory/${id}`),
};
