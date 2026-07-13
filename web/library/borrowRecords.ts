import { api } from './api';
import type { ApiResponse } from './api';
import type { InventoryItem } from './inventory';

// BORROW RECORD TYPE DEFINITIONS
export interface BorrowRecord {
    borrow_record_id: number;
    inventory_id: number;
    borrower_name: string;
    borrower_phone: string | null;
    quantity_borrowed: number;
    location: string | null;
    borrowed_at: string;
    expected_return_date: string;
    actual_return_date: string | null;
    status: 'borrowed' | 'overdue' | 'returned';
    created_at: string;
    updated_at: string;
    inventory?: InventoryItem;
    days_overdue?: number;
    is_overdue?: boolean;
}

export interface CreateBorrowRecordData {
    borrower_name: string;
    borrower_phone?: string | null;
    quantity: number;
    expected_return_date: string;
    location: string;
}

export interface BorrowStatistics {
    borrowed_items: number;
    overdue_items: number;
    returned_items: number;
}

// BORROW RECORDS API
export const borrowRecordsAPI = {
    /**
     * Get all borrowed items 
     */
    getBorrowed: (params?: {
        search?: string;
        status?: 'borrowed' | 'overdue' | 'returned';
        per_page?: number;
        page?: number;
    }) => {
        return api.get<ApiResponse<BorrowRecord[]>>('/admin/inventory/borrowed', { params });
    },

    /**
     * Get all overdue items
     */
    getOverdue: (params?: {
        search?: string;
        per_page?: number;
        page?: number;
    }) => {
        return api.get<ApiResponse<BorrowRecord[]>>('/admin/inventory/overdue', { params });
    },

    /**
     * Get borrow history for a specific item
     */
    getBorrowHistory: (inventoryId: number, params?: {
        per_page?: number;
        page?: number;
    }) => {
        return api.get<ApiResponse<BorrowRecord[]>>(`/admin/inventory/${inventoryId}/history`, { params });
    },

    /**
     * Return a borrowed item 
     */
    returnItem: (inventoryId: number) => {
        return api.post<ApiResponse<BorrowRecord>>(`/admin/inventory/${inventoryId}/return`);
    },

    /**
     * Get all borrow records 
     */
    getAll: (params?: {
        search?: string;
        status?: 'borrowed' | 'overdue' | 'returned';
        per_page?: number;
        page?: number;
    }) => {
        return api.get<ApiResponse<BorrowRecord[]>>('/admin/inventory/borrow-records', { params });
    },
};

/**
 * Check if a borrow record is overdue
 */
export const isBorrowOverdue = (record: BorrowRecord): boolean => {
    if (record.status === 'returned') return false;
    return new Date(record.expected_return_date) < new Date();
};

/**
 * Get days overdue for a borrow record
 */
export const getDaysOverdue = (record: BorrowRecord): number => {
    if (!isBorrowOverdue(record)) return 0;
    const today = new Date();
    const expected = new Date(record.expected_return_date);
    return Math.ceil((today.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Format date for display
 */
export const formatBorrowDate = (date: string | null): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Get status badge color for borrow record
 */
export const getBorrowStatusColor = (status: BorrowRecord['status']): string => {
    const colors = {
        borrowed: 'blue',
        overdue: 'red',
        returned: 'gray'
    };
    return colors[status] || 'gray';
};

/**
 * Get status label for borrow record
 */
export const getBorrowStatusLabel = (status: BorrowRecord['status']): string => {
    const labels = {
        borrowed: 'Borrowed',
        overdue: 'Overdue',
        returned: 'Returned'
    };
    return labels[status] || status;
};