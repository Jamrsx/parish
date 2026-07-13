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
}

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