import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'boiler_auth_token';

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

  async hasToken(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export const SecureStorage = new SecureStorageService();
