import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * General app storage service for non-sensitive data.
 * Uses AsyncStorage for persistent key-value storage.
 */
class AppStorageService {
  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Failed to retrieve ${key}:`, error);
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove ${key}:`, error);
      throw error;
    }
  }

  async setObject<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error(`Failed to save object ${key}:`, error);
      throw error;
    }
  }

  async getObject<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Failed to retrieve object ${key}:`, error);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  }
}

export const AppStorage = new AppStorageService();
