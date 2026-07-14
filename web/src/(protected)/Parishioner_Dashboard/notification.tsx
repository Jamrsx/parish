import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { 
    notificationAPI, 
    formatNotificationTime, 
    getNotificationIcon,
    type Notification 
} from '../../../library/notification';

interface NotificationDropdownProps {
  onClose?: () => void;
}

const NotificationDropdown = ({ onClose }: NotificationDropdownProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUnreadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationAPI.getUnread({ limit: 5 });
      if (response.data?.success && response.data?.data?.notifications) {
        setNotifications(response.data.data.notifications);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications([]);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (notificationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this notification?')) return;
    
    try {
      await notificationAPI.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleViewAll = () => {
    if (onClose) onClose();
    window.location.href = '/parishioner-notifications';
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-pulse">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="w-96 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl border border-gray-200">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b p-3 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Notifications</h3>
        <div className="flex gap-2">
          {notifications.length > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          <button
            onClick={handleViewAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            View all
          </button>
        </div>
      </div>
      
      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <Bell className="mx-auto mb-2 text-gray-300" size={32} />
          <p className="text-sm">No new notifications</p>
        </div>
      ) : (
        <div>
          {notifications.map((notification) => (
            <div
              key={notification.notification_id}
              className="border-b hover:bg-gray-50 p-3 cursor-pointer transition-colors"
              onClick={() => {
                if (notification.request_id) {
                  if (onClose) onClose();
                  window.location.href = `/parishioner-request/${notification.request_id}`;
                }
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatNotificationTime(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => handleMarkAsRead(notification.notification_id, e)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Mark as read"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(notification.notification_id, e)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {notification.request && (
                    <div className="mt-1 text-xs text-gray-400">
                      Request #{notification.request.request_id} • {notification.request.form_type_label}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Footer */}
      {notifications.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t p-2 text-center">
          <button
            onClick={handleViewAll}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View all notifications →
          </button>
        </div>
      )}
    </div>
  );
};

//  MAIN NOTIFICATION COMPONENT 

interface NotificationBellProps {
  className?: string;
}

const NotificationBell = ({ className = '' }: NotificationBellProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationAPI.getUnreadCount();
      if (response.data?.success && response.data?.data?.count !== undefined) {
        setUnreadCount(response.data.data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    const interval = setInterval(fetchUnreadCount, 30000);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchUnreadCount();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    fetchUnreadCount();
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors rounded-full hover:bg-gray-100 focus:outline-none"
        aria-label="Notifications"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50">
          <NotificationDropdown onClose={handleClose} />
        </div>
      )}
    </div>
  );
};

export default NotificationBell;