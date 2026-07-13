import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../library/api';

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user) return;
      try {
        const response = await api.getUnreadCount();
        if (response.success) {
          setUnreadCount(response.data.count);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return unreadCount;
}