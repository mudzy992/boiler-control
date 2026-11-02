import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ColorMode } from './palette';

const STORAGE_KEY = 'boiler.color-mode';

interface AppColorModeContextValue {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
}

const AppColorModeContext = createContext<AppColorModeContextValue>({
  colorMode: 'light',
  setColorMode: () => undefined,
  toggleColorMode: () => undefined,
});

interface AppThemeProviderProps {
  children: React.ReactNode;
  /** Controlled values are used only by the temporary NativeBase bridge. */
  colorMode?: ColorMode;
  toggleColorMode?: () => void;
}

export function AppThemeProvider({
  children,
  colorMode: controlledMode,
  toggleColorMode: controlledToggle,
}: AppThemeProviderProps) {
  const [localMode, setLocalMode] = useState<ColorMode>('light');
  const controlled = controlledMode !== undefined;
  const colorMode = controlledMode ?? localMode;

  useEffect(() => {
    if (controlled) return;
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (mounted && (saved === 'light' || saved === 'dark')) setLocalMode(saved);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [controlled]);

  const setColorMode = useCallback(
    (mode: ColorMode) => {
      if (controlled) {
        if (mode !== colorMode) controlledToggle?.();
        return;
      }
      setLocalMode(mode);
      AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => undefined);
    },
    [colorMode, controlled, controlledToggle],
  );

  const toggleColorMode = useCallback(() => {
    if (controlledToggle) {
      controlledToggle();
      return;
    }
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  }, [colorMode, controlledToggle, setColorMode]);

  const value = useMemo(
    () => ({ colorMode, setColorMode, toggleColorMode }),
    [colorMode, setColorMode, toggleColorMode],
  );

  return <AppColorModeContext.Provider value={value}>{children}</AppColorModeContext.Provider>;
}

export function useAppColorMode(): AppColorModeContextValue {
  return useContext(AppColorModeContext);
}

export function useAppColorModeValue<T>(light: T, dark: T): T {
  const { colorMode } = useAppColorMode();
  return colorMode === 'dark' ? dark : light;
}
