import React from 'react';
import { Tabs } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

export default function Layout() {
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
        name="my_requests"
        options={{
          title: 'My Requests',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="clipboard-list" size={size ?? 28} color={color} />
          ),
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
