import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'boiler_auth_token';
/** SEC-4 (faza 3): refresh token, zaseban ključ da se može rotirati nezavisno. */
const REFRESH_TOKEN_KEY = 'boiler_refresh_token';

/**
 * Secure storage service for sensitive data like authentication tokens.
 * Uses expo-secure-store on supported devices (hardware-backed encryption).
 * Falls back to AsyncStorage on unsupported devices with a warning.
 */
class SecureStorageService {
  private isSecureStoreAvailable = Platform.OS !== 'web';

  async setToken(token: string): Promise<void> {
    try {
      if (this.isSecureStoreAvailable) {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      } else {
        console.warn('SecureStore not available, falling back to AsyncStorage');
        await AsyncStorage.setItem(TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('Failed to save token:', error);
      throw error;
    }
  }

  async getToken(): Promise<string | null> {
    try {
      if (this.isSecureStoreAvailable) {
        return await SecureStore.getItemAsync(TOKEN_KEY);
      } else {
        return await AsyncStorage.getItem(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  }

  async removeToken(): Promise<void> {
    try {
      if (this.isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to remove token:', error);
      throw error;
    }
  }

  /**
   * SEC-4: pohrana refresh tokena.
   *
   * Na Androidu ovo ide u Keystore preko `expo-secure-store`. React Native
   * nema browser cookie jar, pa se httpOnly cookie ovdje ne može osloniti —
   * zato mobilni klijent pri prijavi traži `refreshTransport: 'body'` i čuva
   * token ovdje.
   */
  async setRefreshToken(token: string): Promise<void> {
    try {
      if (this.isSecureStoreAvailable) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      } else {
        console.warn('SecureStore not available, falling back to AsyncStorage');
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('Failed to save refresh token:', error);
      throw error;
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      if (this.isSecureStoreAvailable) {
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      }
      return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error);
      return null;
    }
  }

  async removeRefreshToken(): Promise<void> {
    try {
      if (this.isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      } else {
        await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      console.error('Failed to remove refresh token:', error);
    }
  }

  async hasToken(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export const SecureStorage = new SecureStorageService();
