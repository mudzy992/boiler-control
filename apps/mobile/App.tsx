import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NativeBaseProvider } from 'native-base';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { theme } from './src/theme/theme';
import { colorModeManager } from './src/theme/colorModeManager';
import {
  configureNotificationHandler,
  listenForNotifications,
  setNavigationRef,
} from './src/services/notifications/notificationService';
import './src/locales/config';

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <NativeBaseProvider theme={theme} colorModeManager={colorModeManager}>
          <AuthProvider>
            <StatusBar style="auto" />
            <RootNavigator ref={navigationRef} />
          </AuthProvider>
        </NativeBaseProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
