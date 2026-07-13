import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../../library/api';
import { useAuth } from '../../../../context/AuthContext';
import { useNotifications } from '../../../../context/NotificationContext';

interface NotificationItem {
  notification_id: number;
  user_id: number;
  request_id: number;
  type: string;
  title: string;
  message: string;
  status: 'unread' | 'read';
  created_at: string;
  request?: {
    request_id: number;
    status: string;
  };
}

const { width } = Dimensions.get('window');

// Notification type icons and colors - UPDATED with rescheduled
const NOTIFICATION_CONFIG = {
  // Request status notifications
  request_pending: { icon: 'time', color: '#F59E0B', bgColor: '#FEF3C7' },
  request_approved: { icon: 'checkmark-circle', color: '#10B981', bgColor: '#D1FAE5' },
  request_rejected: { icon: 'close-circle', color: '#EF4444', bgColor: '#FEE2E2' },
  request_cancelled: { icon: 'close-circle', color: '#EF4444', bgColor: '#FEE2E2' },
  request_completed: { icon: 'checkmark-done-circle', color: '#3B82F6', bgColor: '#DBEAFE' },
  request_rescheduled: { icon: 'calendar', color: '#8B5CF6', bgColor: '#EDE9FE' },
  
  // Other notification types
  new_message: { icon: 'chatbubble', color: '#3B82F6', bgColor: '#DBEAFE' },
  system: { icon: 'information-circle', color: '#6B7280', bgColor: '#F3F4F6' },
  status_update: { icon: 'refresh-circle', color: '#6B7280', bgColor: '#F3F4F6' },
  default: { icon: 'notifications', color: '#2563EB', bgColor: '#E0E7FF' },
};

// Helper function to get status from notification type - UPDATED with rescheduled
const getStatusFromType = (type: string) => {
  const statusMap: { [key: string]: string } = {
    'request_pending': 'pending',
    'request_approved': 'approved',
    'request_rejected': 'rejected',
    'request_cancelled': 'cancelled',
    'request_completed': 'completed',
    'request_rescheduled': 'rescheduled',
    'new_request': 'pending',
  };
  return statusMap[type] || null;
};

// Helper function for status colors - UPDATED with rescheduled
const getStatusColorConfig = (status: string) => {
  const config = {
    'pending': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    'approved': { bg: 'bg-green-100', text: 'text-green-700' },
    'rejected': { bg: 'bg-red-100', text: 'text-red-700' },
    'cancelled': { bg: 'bg-red-100', text: 'text-red-700' },
    'completed': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'rescheduled': { bg: 'bg-purple-100', text: 'text-purple-700' },
  };
  return config[status as keyof typeof config] || { bg: 'bg-gray-100', text: 'text-gray-700' };
};

export default function NotificationScreen() {
  const { user, isLoading } = useAuth();
  const { refreshUnreadCount, decrementUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'unread'>('all');
  const [swipeAnimations, setSwipeAnimations] = useState<{ [key: number]: Animated.Value }>({});
  
  // State for feedback
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info'>('success');
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  
  // Add mounted ref to prevent state updates after unmount
  const isMounted = useRef(true);

  // Show feedback with animation
  const showFeedback = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackMessage(message);
    setFeedbackType(type);
    
    Animated.timing(feedbackAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(feedbackAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (isMounted.current) {
          setFeedbackMessage(null);
        }
      });
    }, 2500);
  };

  const fetchNotifications = useCallback(async () => {
    // Skip if not mounted or no user
    if (!isMounted.current) return;
    
    if (!user) {
      console.log('User not authenticated, skipping notification fetch');
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
        setNotifications([]);
      }
      return;
    }

    try {
      const response = await api.getNotifications();
      if (response.success && isMounted.current) {
        const data = response.data.data || [];
        setNotifications(data as NotificationItem[]);
        const animations: { [key: number]: Animated.Value } = {};
        data.forEach((n: NotificationItem) => {
          animations[n.notification_id] = new Animated.Value(0);
        });
        setSwipeAnimations(animations);
      }
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      
      if (error?.status === 401 && isMounted.current) {
        setNotifications([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  const createPanResponder = (notificationId: number) => {
    const pan = swipeAnimations[notificationId] || new Animated.Value(0);
    
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          pan.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -80) {
          Animated.spring(pan, {
            toValue: -width,
            useNativeDriver: true,
            tension: 40,
            friction: 6,
          }).start(() => {
            handleDelete(notificationId);
            pan.setValue(0);
          });
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 6,
          }).start();
        }
      },
    });

    return { pan, panResponder };
  };

  const getNotificationConfig = (type: string) => {
    return NOTIFICATION_CONFIG[type as keyof typeof NOTIFICATION_CONFIG] || NOTIFICATION_CONFIG.default;
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  };

  const handleMarkAsRead = async (notificationId: number) => {
    if (!user || !isMounted.current) {
      Alert.alert('Error', 'Please login to manage notifications');
      return;
    }

    try {
      await api.markNotificationAsRead(notificationId);
      if (isMounted.current) {
        setNotifications(prev =>
          prev.map(n =>
            n.notification_id === notificationId ? { ...n, status: 'read' } : n
          )
        );
        decrementUnreadCount();
        showFeedback('Marked as read', 'success');
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      showFeedback('Failed to mark as read', 'error');
    }
  };

  const handleDelete = async (notificationId: number) => {
    if (!user || !isMounted.current) {
      Alert.alert('Error', 'Please login to manage notifications');
      return;
    }

    try {
      const notification = notifications.find(n => n.notification_id === notificationId);
      const wasUnread = notification?.status === 'unread';
      
      await api.deleteNotification(notificationId);
      if (isMounted.current) {
        setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
        if (wasUnread) {
          decrementUnreadCount();
        }
        showFeedback('Notification deleted', 'success');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      showFeedback('Failed to delete notification', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || !isMounted.current) {
      Alert.alert('Error', 'Please login to manage notifications');
      return;
    }

    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All Read',
          onPress: async () => {
            try {
              await api.markAllNotificationsAsRead();
              if (isMounted.current) {
                setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
                await refreshUnreadCount();
                showFeedback('All notifications marked as read', 'success');
              }
            } catch (error) {
              console.error('Error marking all as read:', error);
              showFeedback('Failed to mark all as read', 'error');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    if (!isMounted.current) return;
    setRefreshing(true);
    fetchNotifications();
    refreshUnreadCount();
  };

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    
    // Initial fetch if user exists
    if (user) {
      fetchNotifications();
    } else {
      setLoading(false);
      setNotifications([]);
    }

    // Cleanup function
    return () => {
      isMounted.current = false;
      setNotifications([]);
      setLoading(false);
      setRefreshing(false);
    };
  }, [user]); // Remove fetchNotifications from dependencies to prevent loops

  const filteredNotifications = notifications.filter(n => 
    selectedTab === 'all' || (selectedTab === 'unread' && n.status === 'unread')
  );

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  // Show loading state
  if (isLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center" edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  // If no user, return null (let auth context handle navigation)
  if (!user) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Feedback Toast */}
      {feedbackMessage && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 60,
            left: 20,
            right: 20,
            zIndex: 1000,
            opacity: feedbackAnim,
            transform: [
              {
                translateY: feedbackAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          }}
        >
          <View
            className={`mx-4 px-5 py-4 rounded-2xl shadow-lg ${
              feedbackType === 'success'
                ? 'bg-green-500'
                : feedbackType === 'error'
                ? 'bg-red-500'
                : 'bg-blue-500'
            }`}
          >
            <Text className="text-white text-center font-medium text-base">
              {feedbackMessage}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <View className="bg-white px-5 py-4 border-b border-gray-200">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Text className="text-2xl font-bold text-gray-800">Notifications</Text>
          </View>
          <View className="flex-row space-x-2">
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={handleMarkAllRead}
                className="px-3 py-2 rounded-lg bg-blue-50"
              >
                <Text className="text-blue-600 text-sm font-semibold">Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row mt-3 bg-gray-100 rounded-lg p-1">
          <TouchableOpacity
            onPress={() => setSelectedTab('all')}
            className={`flex-1 py-2 rounded-lg ${
              selectedTab === 'all' ? 'bg-white' : ''
            }`}
          >
            <Text
              className={`text-center font-medium ${
                selectedTab === 'all' ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedTab('unread')}
            className={`flex-1 py-2 rounded-lg ${
              selectedTab === 'unread' ? 'bg-white' : ''
            }`}
          >
            <Text
              className={`text-center font-medium ${
                selectedTab === 'unread' ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredNotifications.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="notifications-off-outline" size={40} color="#9CA3AF" />
            </View>
            <Text className="text-lg font-semibold text-gray-800">No Notifications</Text>
            <Text className="text-gray-400 text-center mt-2">
              {selectedTab === 'unread' 
                ? "You don't have any unread notifications"
                : "You're all caught up!"}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification) => {
            const config = getNotificationConfig(notification.type);
            const { pan, panResponder } = createPanResponder(notification.notification_id);
            const isUnread = notification.status === 'unread';
            
            const status = getStatusFromType(notification.type);
            const statusColors = status ? getStatusColorConfig(status) : null;

            return (
              <Animated.View
                key={notification.notification_id}
                style={{
                  transform: [{ translateX: pan }],
                }}
                {...panResponder.panHandlers}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    if (isUnread) {
                      handleMarkAsRead(notification.notification_id);
                    }
                    if (notification.request) {
                      // router.push(`/Parishioner/requests/${notification.request.request_id}`);
                    }
                  }}
                  className={`bg-white rounded-2xl p-4 mb-3 shadow-sm border ${
                    isUnread ? 'border-blue-200 shadow-blue-100' : 'border-gray-100'
                  }`}
                >
                  <View className="flex-row items-start">
                    {/* Icon */}
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: config.bgColor }}
                    >
                      <Ionicons name={config.icon as any} size={24} color={config.color} />
                    </View>

                    <View className="flex-1">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-2">
                          <Text className="font-semibold text-gray-800 text-base">
                            {notification.title}
                          </Text>
                          <Text className="text-gray-600 text-sm mt-1 leading-5">
                            {notification.message}
                          </Text>
                        </View>
                        {isUnread && (
                          <View className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1" />
                        )}
                      </View>

                      {status && statusColors && (
                        <View className="mt-2">
                          <View
                            className={`px-3 py-1 rounded-full self-start ${statusColors.bg}`}
                          >
                            <Text className={`text-xs font-medium ${statusColors.text}`}>
                              {status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      )}

                      <View className="flex-row justify-between items-center mt-3 pt-2 border-t border-gray-50">
                        <Text className="text-xs text-gray-400">
                          {getTimeAgo(notification.created_at)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDelete(notification.notification_id)}
                          className="p-1"
                        >
                          <Ionicons name="close-outline" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}
        <View className="h-4" />
      </ScrollView>
    </SafeAreaView>
  );
}