import { api } from './api';
import type { ApiResponse, PaginatedResponse } from './api';

// ============ TYPE DEFINITIONS ============
export type NotificationType =
    | 'request_pending'
    | 'request_approved'
    | 'request_completed'
    | 'request_cancelled'
    | 'request_rescheduled'
    | 'status_update'
    | 'new_request'
    | 'priest_assigned'
    | 'priest_upcoming';
export type NotificationStatus = 'unread' | 'read';

export interface Notification {
    notification_id: number;
    user_id: number;  // ✅ Changed from parishioner_id to user_id
    request_id: number;
    type: NotificationType;
    title: string;
    message: string;
    status: NotificationStatus;
    created_at: string;
    updated_at: string;
    request?: {
        request_id: number;
        status: string;
        form_type_label: string;
        preferred_date?: string;
        preferred_time?: string;
    };
}

export interface NotificationFilters {
    page?: number;
    per_page?: number;
    status?: NotificationStatus | 'all';
}

// ============ NOTIFICATION API ============
export const notificationAPI = {
    /**
     * Get all notifications with pagination - ✅ Uses user endpoint
     */
    getAll: (filters?: NotificationFilters) => 
        api.get<ApiResponse<PaginatedResponse<Notification>>>('/notifications', { 
            params: filters 
        }),

    /**
     * Get unread notification count (for badge) - ✅ Uses user endpoint
     */
    getUnreadCount: () => 
        api.get<ApiResponse<{ count: number }>>('/notifications/unread-count'),

    /**
     * Get unread notifications (for dropdown) - ✅ Uses user endpoint
     */
    getUnread: (params?: { limit?: number }) => 
        api.get<ApiResponse<{ notifications: Notification[] }>>('/notifications/unread', { 
            params 
        }),

    /**
     * Mark a single notification as read - ✅ Uses user endpoint
     */
    markAsRead: (notificationId: number) => 
        api.post<ApiResponse<{ message: string }>>(`/notifications/${notificationId}/mark-read`),

    /**
     * Mark all notifications as read - ✅ Uses user endpoint
     */
    markAllAsRead: () => 
        api.post<ApiResponse<{ message: string }>>('/notifications/mark-all-read'),

    /**
     * Delete a notification - ✅ Uses user endpoint
     */
    delete: (notificationId: number) => 
        api.delete<ApiResponse<{ message: string }>>(`/notifications/${notificationId}`),

    // ============ PARISHIONER-SPECIFIC ENDPOINTS ============
    
    /**
     * Get notifications for parishioner - ✅ Uses parishioner endpoint
     */
    getParishionerNotifications: (filters?: NotificationFilters) => 
        api.get<ApiResponse<PaginatedResponse<Notification>>>('/parishioner/notifications', { 
            params: filters 
        }),

    /**
     * Get unread count for parishioner - ✅ Uses parishioner endpoint
     */
    getParishionerUnreadCount: () => 
        api.get<ApiResponse<{ count: number }>>('/parishioner/notifications/unread-count'),

    /**
     * Get unread notifications for parishioner - ✅ Uses parishioner endpoint
     */
    getParishionerUnread: (params?: { limit?: number }) => 
        api.get<ApiResponse<{ notifications: Notification[] }>>('/parishioner/notifications/unread', { 
            params 
        }),

    /**
     * Mark a notification as read for parishioner - ✅ Uses parishioner endpoint
     */
    markParishionerAsRead: (notificationId: number) => 
        api.post<ApiResponse<{ message: string }>>(`/parishioner/notifications/${notificationId}/mark-read`),

    /**
     * Mark all notifications as read for parishioner - ✅ Uses parishioner endpoint
     */
    markParishionerAllAsRead: () => 
        api.post<ApiResponse<{ message: string }>>('/parishioner/notifications/mark-all-read'),

    /**
     * Delete a notification for parishioner - ✅ Uses parishioner endpoint
     */
    deleteParishioner: (notificationId: number) =>
        api.delete<ApiResponse<{ message: string }>>(`/parishioner/notifications/${notificationId}`),

    // Priest notifications
    getPriestAll: (filters?: NotificationFilters) =>
        api.get<ApiResponse<PaginatedResponse<Notification>>>('/priest/notifications', {
            params: filters,
        }),

    getPriestUnreadCount: () =>
        api.get<ApiResponse<{ count: number }>>('/priest/notifications/unread-count'),

    getPriestUnread: (limit = 10) =>
        api.get<ApiResponse<{ notifications: Notification[] }>>('/priest/notifications/unread', {
            params: { limit },
        }),

    markPriestAsRead: (notificationId: number) =>
        api.post<ApiResponse<{ message: string }>>(`/priest/notifications/${notificationId}/mark-read`),

    markPriestAllAsRead: () =>
        api.post<ApiResponse<{ message: string }>>('/priest/notifications/mark-all-read'),
};

// ============ HELPER FUNCTIONS ============

/**
 * Format notification time (e.g., "2 hours ago")
 */
export const formatNotificationTime = (createdAt: string): string => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return created.toLocaleDateString();
};

/**
 * Get notification icon based on type
 */
export const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
        case 'new_request':
        case 'request_pending':
            return '📋';
        case 'request_approved':
            return '✅';
        case 'request_completed':
            return '🎉';
        case 'request_cancelled':
            return '❌';
        case 'request_rescheduled':
            return '🔄';
        case 'status_update':
            return '📝';
        default:
            return '🔔';
    }
};

/**
 * Get notification color based on type
 */
export const getNotificationColor = (type: NotificationType): string => {
    switch (type) {
        case 'new_request':
        case 'request_pending':
            return 'blue';
        case 'request_approved':
            return 'green';
        case 'request_completed':
            return 'purple';
        case 'request_cancelled':
            return 'red';
        case 'request_rescheduled':
            return 'orange';
        case 'status_update':
            return 'gray';
        default:
            return 'gray';
    }
};

/**
 * Get notification status label
 */
export const getStatusLabel = (status: NotificationStatus): string => {
    return status === 'unread' ? 'Unread' : 'Read';
};

/**
 * Get notification status color
 */
export const getStatusColor = (status: NotificationStatus): string => {
    return status === 'unread' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
};

/**
 * Group notifications by date
 */
export const groupNotificationsByDate = (notifications: Notification[]): Record<string, Notification[]> => {
    const groups: Record<string, Notification[]> = {};
    
    notifications.forEach((notification: Notification) => {
        const date = new Date(notification.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(notification);
    });
    
    return groups;
};

/**
 * Sort notifications by date (newest first)
 */
export const sortNotificationsByDate = (notifications: Notification[]): Notification[] => {
    return [...notifications].sort((a: Notification, b: Notification) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
};

/**
 * Get notification title based on type
 */
export const getNotificationTitle = (type: NotificationType): string => {
    switch (type) {
        case 'new_request':
        case 'request_pending':
            return 'New Request';
        case 'request_approved':
            return 'Request Approved';
        case 'request_completed':
            return 'Request Completed';
        case 'request_cancelled':
            return 'Request Cancelled';
        case 'request_rescheduled':
            return 'Request Rescheduled';
        case 'status_update':
            return 'Status Update';
        default:
            return 'Notification';
    }
};

/**
 * Check if notification is for a specific type
 */
export const isNotificationType = (notification: Notification, type: NotificationType): boolean => {
    return notification.type === type;
};

/**
 * Get notification count by type
 */
export const getNotificationCountByType = (notifications: Notification[], type: NotificationType): number => {
    return notifications.filter(n => n.type === type).length;
};

/**
 * Get unread notifications count
 */
export const getUnreadCount = (notifications: Notification[]): number => {
    return notifications.filter(n => n.status === 'unread').length;
};

/**
 * Get read notifications count
 */
export const getReadCount = (notifications: Notification[]): number => {
    return notifications.filter(n => n.status === 'read').length;
};