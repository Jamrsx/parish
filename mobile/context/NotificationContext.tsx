import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../library/api';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
  setUnreadCount: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isParishioner } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);


  // REFRESH UNREAD COUNT

  const refreshUnreadCount = useCallback(async () => {
    if (!user || !isParishioner) {
      setUnreadCount(0);
      return;
    }
    
    try {
      const response = await api.getUnreadCount();
      if (response.success) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [user, isParishioner]);

  const checkRequestExpiration = useCallback(async () => {
    if (!user || !isParishioner) return;

    try {
      const response = await api.expirePendingRequests();
      console.log('Request expiration check:', response.data);
      if (response.success && response.data.expired_count > 0) {
        await refreshUnreadCount();
      }
    } catch (error) {
      console.error('Failed to check request expiration:', error);
    }
  }, [user, isParishioner, refreshUnreadCount]);


  // INCREMENT UNREAD COUNT

  const incrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => prev + 1);
  }, []);


  // DECREMENT UNREAD COUNT

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);


  // FETCH UNREAD COUNT ON USER CHANGE

  useEffect(() => {
    if (user && isParishioner) {
      checkRequestExpiration();
      refreshUnreadCount();
      
      const interval = setInterval(() => {
        checkRequestExpiration();
        refreshUnreadCount();
      }, 15000);
      return () => clearInterval(interval);
    } else {
      setUnreadCount(0);
    }
  }, [user, isParishioner, refreshUnreadCount, checkRequestExpiration]);


  // PROVIDER VALUE

  return (
    <NotificationContext.Provider 
      value={{ 
        unreadCount, 
        refreshUnreadCount, 
        incrementUnreadCount,
        decrementUnreadCount,
        setUnreadCount 
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// USE NOTIFICATIONS HOOK
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}