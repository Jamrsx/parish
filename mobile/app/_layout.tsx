import { Stack } from 'expo-router';
import React from 'react';
import '../global.css';
import { AuthProvider } from '../context/AuthContext';
import { AuthNavigationGate } from '../components/AuthNavigationGate';
import { View } from 'react-native';

export default function RootLayout() {
  return (
    <AuthProvider>
      <View className="flex-1">
        <AuthNavigationGate />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="Parishioner" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, gestureEnabled: false }} />
        </Stack>
      </View>
    </AuthProvider>
  );
}