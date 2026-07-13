import { Stack } from 'expo-router';
import React from 'react';


export default function ParishionerLayout() {
  return (
      <Stack>
        <Stack.Screen name="(protected)" options={{ headerShown: false }} />
      </Stack>
  );
}