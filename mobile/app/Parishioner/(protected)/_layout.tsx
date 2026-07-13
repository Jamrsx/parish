import { Stack } from 'expo-router';
import React from 'react';
import { AuthGuard } from '../../../components/AuthGuard';

export default function ProtectedLayout() {
  return (
    <AuthGuard>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="certificate_request" options={{ headerShown: false }} />
        <Stack.Screen name="forms_request" options={{ headerShown: false }} />
      </Stack>
    </AuthGuard>
  );
}