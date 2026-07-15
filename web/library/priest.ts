import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';
import type { DailyReportData } from './cashier';
import type { InventoryItem } from './inventory';

/**
 * Priest read-only APIs — income and inventory viewing only.
 */
export const priestAPI = {
  /**
   * Daily income for a given date (same data as cashier daily report).
   */
  getIncome: (date: string) => {
    console.log('Priest fetching income for:', date);
    return api.get<ApiResponse<DailyReportData>>('/priest/income', { params: { date } });
  },

  /**
   * List inventory items (view only).
   */
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
