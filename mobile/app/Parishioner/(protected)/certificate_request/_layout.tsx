import React from 'react';
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="BaptismalCertificate" options={{ headerShown: false }} />
      <Stack.Screen name="MarriageCertificate" options={{ headerShown: false }} />
    </Stack>
  );
}