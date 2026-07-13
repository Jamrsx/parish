import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatusBar } from 'react-native';

export default function AuthLayout() {
  const { isAuthenticated, isLoading, isParishioner } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (isParishioner) {
        router.replace('/Parishioner/(protected)/(tabs)/home');
      } 
    }
  }, [isAuthenticated, isLoading, isParishioner, router]);

  return (
    <>
      <StatusBar backgroundColor="#2563EB" barStyle="light-content" />
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}