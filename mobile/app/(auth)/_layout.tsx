import { Stack, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ActivityIndicator, StatusBar, View } from 'react-native';

export default function AuthLayout() {
  const { isAuthenticated, isLoading, isParishioner } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && isParishioner) {
      console.log('Auth layout: user already logged in — redirecting away from login');
      router.replace('/Parishioner/(protected)/(tabs)/home');
    }
  }, [isAuthenticated, isLoading, isParishioner, router]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (isAuthenticated && isParishioner) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <>
      <StatusBar backgroundColor="#2563EB" barStyle="light-content" />
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}