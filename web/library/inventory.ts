import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';
import type { BorrowRecord } from './borrowRecords';

// INVENTORY TYPE DEFINITIONS
export interface InventoryItem {
    inventory_id: number;
    name: string;
    quantity: number;
    type: 'item' | 'consumable';
    category?: string;
    is_borrowable: boolean;
    is_builtin?: boolean;
    ran_out_at?: string | null;
    created_at: string;
    updated_at: string;
    available_quantity?: number;
    current_status?: 'available' | 'borrowed' | 'overdue' | 'returned' | 'out_of_stock';
    display_status?: string;
}

export interface CreateInventoryData {
    name: string;
    quantity: number;
    type: 'item' | 'consumable';
    category?: string;
    is_borrowable?: boolean;
}

export interface UpdateInventoryData {
    name?: string;
    quantity?: number;
    type?: 'item' | 'consumable';
    category?: string;
    is_borrowable?: boolean;
    history_note?: string;
}

export type InventoryHistoryAction =
    | 'created'
    | 'stock_in'
    | 'stock_out'
    | 'borrowed'
    | 'returned'
    | 'returned_damaged'
    | 'edited'
    | 'deleted';

export type InventoryHistoryGroup = 'all' | 'stock_in' | 'stock_out' | 'new' | 'borrow' | 'edits';

export interface InventoryHistoryChange {
    field: string;
    label: string;
    from: string | number | boolean | null;
    to: string | number | boolean | null;
}

export interface InventoryHistoryRow {
    history_id: number;
    inventory_id: number | null;
    item_name: string;
    action: InventoryHistoryAction;
    action_label: string;
    quantity_change: number;
    quantity_before: number | null;
    quantity_after: number | null;
    borrow_record_id: number | null;
    details: {
        changes?: InventoryHistoryChange[];
        borrower_name?: string | null;
        borrower_phone?: string | null;
        location?: string | null;
        expected_return_date?: string | null;
        quantity_borrowed?: number;
        quantity_damaged?: number;
        damage_notes?: string | null;
        category?: string | null;
        type?: string | null;
        is_borrowable?: boolean;
        source?: string;
    } | null;
    notes: string | null;
    performed_by: string | null;
    performed_by_role: string | null;
    occurred_at: string;
}

export interface InventoryHistorySummary {
    stock_in_qty: number;
    stock_in_count: number;
    stock_out_qty: number;
    stock_out_count: number;
    new_items: number;
    borrowed: number;
    returned: number;
    edits: number;
    total: number;
}

export interface InventoryHistoryParams {
    group?: InventoryHistoryGroup;
    inventory_id?: number;
    date_from?: string;
    date_to?: string;
    search?: string;
    per_page?: number;
    page?: number;
}

export type InventoryHistoryResponse = ApiResponse<PaginatedResponse<InventoryHistoryRow>> & {
    summary?: InventoryHistorySummary;
};

export interface BorrowFormData {
    borrower_name: string;
    borrower_phone?: string | null;
    quantity: number;
    expected_return_date: string;
    location: string;
}

export interface InventoryStatistics {
    total_items: number;
    total_consumables: number;
    available_items: number;
    out_of_stock_items: number;
    borrowed_items: number;
    overdue_items: number;
    returned_items: number;
    total_quantity: number;
    category_counts?: Record<string, number>;
}

// INVENTORY API
export const inventoryAPI = {
    /**
     * Get all inventory items with optional filtering
     */
    getAll: (params?: {
        search?: string;
        type?: 'item' | 'consumable';
        is_borrowable?: boolean;
        per_page?: number;
        page?: number;
    }) => {
        return api.get<ApiResponse<PaginatedResponse<InventoryItem>>>('/admin/inventory', { params });
    },

    /**
     * Get a single inventory item by ID
     */
    getById: (id: number) => {
        return api.get<ApiResponse<InventoryItem>>(`/admin/inventory/${id}`);
    },

    /**
     * Create a new inventory item
     */
    create: (data: CreateInventoryData) => {
        return api.post<ApiResponse<InventoryItem>>('/admin/inventory', data);
    },

    /**
     * Update an existing inventory item
     */
    update: (id: number, data: UpdateInventoryData) => {
        return api.put<ApiResponse<InventoryItem>>(`/admin/inventory/${id}`, data);
    },

    /**
     * Delete an inventory item
     */
    delete: (id: number) => {
        return api.delete<ApiResponse<null>>(`/admin/inventory/${id}`);
    },

    /**
     * Borrow an item - Creates a borrow record
     */
    borrow: (id: number, data: BorrowFormData) => {
        return api.post<ApiResponse<BorrowRecord>>(`/admin/inventory/${id}/borrow`, data);
    },

    /**
     * Get inventory statistics
     */
    getStatistics: () => {
        return api.get<ApiResponse<InventoryStatistics>>('/admin/inventory/statistics');
    },

    /**
     * Search inventory items
     */
    search: (query: string) => {
        return api.get<ApiResponse<InventoryItem[]>>('/admin/inventory/search', {
            params: { q: query }
        });
    },

    /**
 * Get all categories
 */
    getCategories: () => {
        return api.get<ApiResponse<string[]>>('/admin/inventory/categories');
    },

    getHistory: (params?: InventoryHistoryParams) => {
        console.log('[InventoryHistory] Fetch (secretary):', params);
        return api.get<InventoryHistoryResponse>('/admin/inventory/history', { params });
    }
};

/**
 * Get display status for an item
 */
export const getDisplayStatus = (item: InventoryItem): string => {
    if (item.current_status === 'borrowed') return 'borrowed';
    if (item.current_status === 'overdue') return 'overdue';
    if (item.current_status === 'returned') return 'returned';
    if (item.current_status === 'out_of_stock' || item.quantity <= 0) return 'out of stock';
    return 'available';
};

/**
 * Format date for display
 */
export const formatDate = (date: string | null): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Get status badge color
 */
export const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        available: 'green',
        borrowed: 'blue',
        overdue: 'red',
        returned: 'gray',
        'out of stock': 'yellow'
    };
    return colors[status] || 'gray';
};

/**
 * Get status label
 */
export const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        available: 'Available',
        borrowed: 'Borrowed',
        overdue: 'Overdue',
        returned: 'Returned',
        'out of stock': 'Out of Stock'
    };
    return labels[status] || status;


};