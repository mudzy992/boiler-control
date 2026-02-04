import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorMode } from 'native-base';

const STORAGE_KEY = 'boiler.color-mode';

export const colorModeManager = {
  get: async (): Promise<ColorMode> => {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      return (value || 'light') as ColorMode;
    } catch (error) {
      return 'light' as ColorMode;
    }
  },
  set: async (value: ColorMode | null) => {
    try {
      if (value) {
        await AsyncStorage.setItem(STORAGE_KEY, value);
      }
    } catch (error) {
      return;
    }
  },
};
