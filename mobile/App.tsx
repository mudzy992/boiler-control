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

    loadLanguage();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowAnimatedSplash(false);
    }, 2500);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <StatusBar style="auto" />
              <RootNavigator ref={navigationRef} />
              <AnimatedSplash
                visible={showAnimatedSplash}
                onFinished={() => setShowAnimatedSplash(false)}
              />
            </AuthProvider>
          </ToastProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
