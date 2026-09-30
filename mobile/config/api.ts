import { LOCAL_API_URL } from './api.local';
import { PRODUCTION_API_URL } from './api.production';

export type ApiEnvironment = 'local' | 'production';

// Change this to force a server while testing in Expo Go. Leave null to use the automatic choice:
// EAS builds use EXPO_PUBLIC_API_ENV from eas.json, `npx expo start` uses local.
const FORCE_API_ENV: ApiEnvironment | null = null;

const envFromBuild = process.env.EXPO_PUBLIC_API_ENV;

export const API_ENV: ApiEnvironment =
  FORCE_API_ENV ??
  (envFromBuild === 'production' || envFromBuild === 'local'
    ? envFromBuild
    : __DEV__
      ? 'local'
      : 'production');

export const API_BASE_URL = API_ENV === 'production' ? PRODUCTION_API_URL : LOCAL_API_URL;

console.log('[API Config]', { env: API_ENV, baseUrl: API_BASE_URL });
