import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';

interface ParishionerHeaderProps {
  title: string;
  subtitle?: string;
  showNotification?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export default function ParishionerHeader({
  title,
  subtitle,
  showNotification = true,
  showBack = false,
  onBack,
  rightContent,
}: ParishionerHeaderProps) {
  const router = useRouter();
  const { unreadCount } = useNotifications();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    router.back();
  };

  const handleOpenNotifications = () => {
    console.log('Opening notifications from header');
    router.push('/Parishioner/notification');
  };

  return (
    <View className="bg-white px-5 py-3 border-b border-gray-200">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-3">
          {showBack ? (
            <TouchableOpacity
              onPress={handleBack}
              className="mr-3 w-10 h-10 rounded-full items-center justify-center bg-gray-50"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color="#374151" />
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10 rounded-full items-center justify-center bg-blue-100 mr-3">
              <FontAwesome5 name="church" size={16} color="#2563EB" />
            </View>
          )}

          <View className="flex-1">
            <Text className="font-bold text-gray-800 text-lg" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-xs text-gray-500" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {rightContent}

        {showNotification && !rightContent ? (
          <TouchableOpacity
            onPress={handleOpenNotifications}
            className="w-10 h-10 rounded-full items-center justify-center bg-gray-50 border border-gray-200"
            accessibilityLabel="Open notifications"
          >
            <Ionicons name="notifications-outline" size={22} color="#2563EB" />
            {unreadCount > 0 ? (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                <Text className="text-white text-[10px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
