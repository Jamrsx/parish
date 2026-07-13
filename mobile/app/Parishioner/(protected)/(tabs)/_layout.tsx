import React from 'react';
import { Tabs } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NotificationProvider, useNotifications } from '../../../../context/NotificationContext';


function TabsNavigator() {
  const { unreadCount } = useNotifications();

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="home" size={size ?? 28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="church_service"
        options={{
          title: 'Church Service',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="church" size={size ?? 28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notification"
        options={{
          title: 'Notification',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size ?? 28} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            fontSize: 10,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="user-circle" size={size ?? 28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <NotificationProvider>
      <TabsNavigator />
    </NotificationProvider>
  );
}