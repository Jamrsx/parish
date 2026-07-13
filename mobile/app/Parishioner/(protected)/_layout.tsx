import { Stack } from 'expo-router';
import React from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { NotificationProvider } from '../../../context/NotificationContext';

export default function ProtectedLayout() {
  return (
    <AuthGuard>
      <NotificationProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="notification" options={{ headerShown: false }} />
          <Stack.Screen name="certificate_request" options={{ headerShown: false }} />
          <Stack.Screen name="forms_request" options={{ headerShown: false }} />
        </Stack>
      </NotificationProvider>
    </AuthGuard>
  );
}