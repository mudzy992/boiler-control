import React, { useEffect } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  LinkingOptions,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useColorMode, Spinner, Center } from 'native-base';
import { BackHandler } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { MainTabNavigator } from './MainTabNavigator';

// Polyfill for BackHandler compatibility with React Navigation 7.x and RN 0.81.5
if (typeof (BackHandler as any).removeEventListener !== 'function') {
  (BackHandler as any).removeEventListener = () => {};
}

const Stack = createStackNavigator();

/**
 * Deep linking configuration for handling deep links from push notifications
 * Supports: myapp://gas/add-reading
 */
const linking: LinkingOptions<any> = {
  prefixes: ['myapp://', 'exp://'],
  config: {
    screens: {
      Main: {
        screens: {
          Gas: {
            screens: {
              'add-reading': 'add-reading',
              GasReadings: 'readings',
              GasAnalysis: 'analysis',
            },
          },
          Dashboard: 'dashboard',
          Heating: 'heating',
          Settings: 'settings',
        },
      },
      Login: 'login',
      Register: 'register',
    },
  },
};

export const RootNavigator = React.forwardRef<NavigationContainerRef<any>, {}>(({}, ref) => {
  const { isAuthenticated, isLoading, restoreSession } = useAuth();
  const { colorMode } = useColorMode();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (isLoading) {
    return (
      <Center flex={1} bg={colorMode === 'dark' ? 'dark.900' : 'gray.50'}>
        <Spinner size="lg" color="brand.400" />
      </Center>
    );
  }

  const navigationTheme = colorMode === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      ref={ref}
      theme={navigationTheme}
      linking={linking}
      fallback={
        <Center flex={1}>
          <Spinner color="brand.400" />
        </Center>
      }
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          // Main App Stack
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            {/* Modal screens will be added here in future phases */}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
});
