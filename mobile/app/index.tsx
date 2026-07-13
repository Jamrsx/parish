import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, Text } from 'react-native';

export default function Index() {
  const { isAuthenticated, isLoading, isParishioner, authError } = useAuth(); 

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && isParishioner) {
        router.replace('/Parishioner/(protected)/(tabs)/home');
      } else if (authError) {
        const timer = setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2500);
        return () => clearTimeout(timer);
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isAuthenticated, isLoading, isParishioner, authError]);

  if (isLoading || authError) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-4">
        {isLoading ? (
          <ActivityIndicator size="large" color="#2563EB" />
        ) : null}
        
        {authError && (
          <>
            <Text className="mt-4 text-red-500 text-center text-base">
              {authError}
            </Text>
            <Text className="mt-2 text-gray-400 text-sm">
              Redirecting to login...
            </Text>
          </>
        )}
      </View>
    );
  }

  return null;
}