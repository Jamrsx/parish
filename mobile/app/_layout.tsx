import { Stack } from 'expo-router';
import React from 'react';
import '../global.css';
import { AuthProvider } from '../context/AuthContext';
import { View } from 'react-native';

export default function RootLayout() {
  return (
    <AuthProvider>
      <View className="flex-1">
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="Parishioner" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
      </View>
    </AuthProvider>
  );
}