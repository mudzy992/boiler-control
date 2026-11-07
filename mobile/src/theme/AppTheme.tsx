import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import type { ColorMode } from './palette';

/** Sistemska tema; `null` (nepoznato) pada na dark, ne na light. */
function systemColorMode(): ColorMode {
  try {
    return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  } catch {
    return DEFAULT_COLOR_MODE;
  }
}

export { DEFAULT_COLOR_MODE, systemColorMode };

const STORAGE_KEY = 'boiler.color-mode';

interface AppColorModeContextValue {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
}

/**
 * Odluka vlasnika 2026-11-07: default tema je DARK, kao na webu
 * (`frontend/src/design/tokens.css` je dark-first). Svijetla tema ostaje
 * ravnopravna — korisnik je bira u Postavkama, a izbor se perzistira pod
 * `boiler.color-mode`.
 *
 * Namjerno se NE čita sistemska tema na prvom startu: aplikacija je operaterski
 * instrument i njen identitet je tamna podloga. „Sistem" je opcija, ne default.
 */
const DEFAULT_COLOR_MODE: ColorMode = 'dark';

const AppColorModeContext = createContext<AppColorModeContextValue>({
  colorMode: DEFAULT_COLOR_MODE,
  setColorMode: () => undefined,
  toggleColorMode: () => undefined,
});

interface AppThemeProviderProps {
  children: React.ReactNode;
  /** Controlled values keep app/theme tests deterministic. */
  colorMode?: ColorMode;
  toggleColorMode?: () => void;
}

export function AppThemeProvider({
  children,
  colorMode: controlledMode,
  toggleColorMode: controlledToggle,
}: AppThemeProviderProps) {
  const [localMode, setLocalMode] = useState<ColorMode>(DEFAULT_COLOR_MODE);
  const controlled = controlledMode !== undefined;
  const colorMode = controlledMode ?? localMode;

  useEffect(() => {
    if (controlled) return;
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        // `system` se razrješava u stvarnu vrijednost; nepoznata vrijednost
        // (stari ključ, corrupt) pada na default, ne na 'light'.
        if (!mounted) return;
        if (saved === 'light' || saved === 'dark') {
          setLocalMode(saved);
        } else if (saved === 'system') {
          setLocalMode(systemColorMode());
        }
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
