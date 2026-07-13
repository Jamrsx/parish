import React from 'react';
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="BaptismForm" options={{ headerShown: false }} />
      <Stack.Screen name="FuneralMassForm" options={{ headerShown: false }} />
      <Stack.Screen name="HouseBlessingsForm" options={{ headerShown: false }} />
      <Stack.Screen name="MarriageInquiryForm" options={{ headerShown: false }} />
    </Stack>
  );
}