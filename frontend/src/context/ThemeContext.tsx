import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * FE2-13 (FE-021): izvezeno namjerno — inline skripta u `index.html` koja
 * sprječava dark-mode FOUC mora čitati ISTI ključ. Test
 * `src/components/__tests__/accessibility.test.tsx` uspoređuje ovu vrijednost s
 * onom u index.html, pa promjena ključa na jednom mjestu pada na CI umjesto da
 * tiho resetuje temu pri svakom reloadu.
 */
export const THEME_STORAGE_KEY = 'boiler.theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const algorithm = mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  const antdConfig = useMemo(
    () => ({
      algorithm,
      token: {
        colorPrimary: '#ff6b3d',
        colorInfo: '#ff6b3d',
        colorBgBase: mode === 'dark' ? '#0b0f1a' : '#f6f7fb',
        colorTextBase: mode === 'dark' ? '#e5e7eb' : '#111827',
        colorBorder: mode === 'dark' ? '#1f2937' : '#e5e7eb',
        borderRadius: 12,
      },
      components: {
        Layout: {
          headerBg: mode === 'dark' ? '#0f172a' : '#ffffff',
          siderBg: mode === 'dark' ? '#0f172a' : '#ffffff',
          bodyBg: mode === 'dark' ? '#0b0f1a' : '#f6f7fb',
        },
        Card: {
          colorBgContainer: mode === 'dark' ? '#111827' : '#ffffff',
        },
      },
    }),
    [algorithm, mode]
  );

  const value = useMemo(() => ({ mode, toggleMode, setMode }), [mode, toggleMode]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
};
