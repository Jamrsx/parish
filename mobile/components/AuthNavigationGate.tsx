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

    // Expo Router typed segments omit some runtime roots (e.g. "index", "(auth)").
    const segmentList = segments as string[];
    const root = segmentList[0];
    const inAuthGroup = root === '(auth)' || root === 'login' || root === 'signup';
    const inProtected =
      root === 'Parishioner' || segmentList.includes('(protected)');

    console.log('AuthNavigationGate:', {
      isAuthenticated,
      isParishioner,
      segments: segmentList.join('/'),
      inAuthGroup,
      inProtected,
    });

    if (isAuthenticated && isParishioner) {
      // Typed routes omit "index"; cast for runtime entry/splash segment.
      if (inAuthGroup || !root || (root as string) === 'index') {
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
      const segmentList = segments as string[];
      const root = segmentList[0];
      const inAuthGroup = root === '(auth)' || root === 'login' || root === 'signup';

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
