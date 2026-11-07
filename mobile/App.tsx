import './global.css';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import {
  configureNotificationHandler,
  listenForNotifications,
} from './src/services/notifications/notificationService';
import i18n from './src/locales/config';
import { AppStorage } from './src/services/storage/AppStorage';
import { AppThemeProvider } from './src/theme/AppTheme';
import { useAppFonts } from './src/theme/fonts';
import { ToastProvider } from './src/components/ui/nativewind';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (cache time)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [appSplashMinimumElapsed, setAppSplashMinimumElapsed] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    configureNotificationHandler();

    // Pass navigation ref directly to listener setup
    const cleanup = listenForNotifications(
      navigationRef as React.RefObject<NavigationContainerRef<any>>
    );

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    const loadLanguage = async () => {
      const savedLanguage = await AppStorage.get('app.language');
      if (savedLanguage && savedLanguage !== i18n.language) {
        await i18n.changeLanguage(savedLanguage);
      }
    };

    loadLanguage()
      .catch(() => undefined)
      .finally(() => setLanguageReady(true));
  }, []);

  /**
   * F4 (UX-23): splash je ranije trajao fiksno 2,5 s bez veze sa spremnošću.
   * Sada se sklanja čim su jezik i fontovi spremni, uz dva ograničenja:
   *  - najkraće 600 ms, da se ne vidi „bijeli bljesak" između splasha i ekrana;
   *  - najduže 2,5 s, da spor disk ili mreža ne zadrže korisnika na splashi.
   */
  const fontsReady = useAppFonts().loaded;

  useEffect(() => {
    const minimum = setTimeout(() => setAppSplashMinimumElapsed(true), 600);
    const maximum = setTimeout(() => setShowAnimatedSplash(false), 2500);
    return () => {
      clearTimeout(minimum);
      clearTimeout(maximum);
    };
  }, []);

  // Izvedeno stanje, ne još jedan `setState` u efektu: splash je vidljiv dok
  // traje minimum ILI dok jezik/fontovi nisu spremni.
  const splashVisible =
    showAnimatedSplash && !(appSplashMinimumElapsed && languageReady && fontsReady);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <StatusBar style="auto" />
              <RootNavigator ref={navigationRef} />
              <AnimatedSplash
                visible={splashVisible}
                onFinished={() => setShowAnimatedSplash(false)}
              />
            </AuthProvider>
          </ToastProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
