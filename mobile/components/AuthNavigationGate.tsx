import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { BackHandler, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';

/**
 * Keeps auth and app routes separated so a logged-in user cannot
 * return to the login/signup screens with the back button.
 */
export function AuthNavigationGate() {
  const { isAuthenticated, isLoading, isParishioner } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading || !navigationState?.key) return;

    const root = segments[0];
    const inAuthGroup = root === '(auth)';
    const segmentList = segments as string[];
    const inProtected =
      root === 'Parishioner' || segmentList.includes('(protected)');

    console.log('AuthNavigationGate:', {
      isAuthenticated,
      isParishioner,
      segments: segments.join('/'),
      inAuthGroup,
      inProtected,
    });

    if (isAuthenticated && isParishioner) {
      if (inAuthGroup || root === 'index' || !root) {
        router.replace('/Parishioner/(protected)/(tabs)/home');
      }
      return;
    }

    // Not authenticated — send away from protected areas
    if (!isAuthenticated && inProtected) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, isParishioner, segments, navigationState?.key, router]);

  // Android hardware back: never leave protected app into login while logged in
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (isLoading || !isAuthenticated || !isParishioner) return;

    const onBackPress = () => {
      const root = segments[0];
      const inAuthGroup = root === '(auth)';

      if (inAuthGroup) {
        router.replace('/Parishioner/(protected)/(tabs)/home');
        return true;
      }

      // At root of app — block exiting toward login history
      if (!router.canGoBack()) {
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isAuthenticated, isLoading, isParishioner, segments, router]);

  return null;
}
