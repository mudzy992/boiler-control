import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Centralized API Configuration
 * Single source of truth for backend URL across the entire application.
 */

/**
 * Get the backend API base URL.
 * Priority order:
 * 1. Environment variable from EAS build (EXPO_PUBLIC_API_URL)
 * 2. app.config.js extra configuration
 * 3. Default development URL based on platform
 */
const getApiBaseUrl = (): string => {
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

  // Get the API URL from environment variables (set by EAS builds)
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? extra.EXPO_PUBLIC_API_URL;

  if (apiUrl) {
    return apiUrl;
  }

  // Development defaults (when no env var is set)
  // Android emulator needs 10.0.2.2 to reach host machine's localhost
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'https://boiler.ba101.top/backend/api';
    }
    return 'https://boiler.ba101.top/backend/api';
  }

  // Fallback (should never reach here in production)
  throw new Error('API_URL not configured. Please set EXPO_PUBLIC_API_URL in eas.json or .env');
};

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 2,
} as const;
