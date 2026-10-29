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
import {
  DEEP_LINK_PREFIXES,
  GAS_TAB_SCREENS,
  MAIN_TAB_SCREENS,
  ROOT_SCREENS,
} from '../constants/routes';
import { handleColdStartNotification } from '../services/notifications/notificationService';

// Polyfill for BackHandler compatibility with React Navigation 7.x and RN 0.81.5
if (typeof (BackHandler as any).removeEventListener !== 'function') {
  (BackHandler as any).removeEventListener = () => {};
}

const Stack = createStackNavigator();

/**
 * Deep linking configuration for handling deep links from push notifications.
 *
 * MO2-3: ključevi u `screens` MORAJU biti registrovana imena ruta. Prije je ovdje
 * stajalo `GasReadings` / `GasAnalysis` / `add-reading`, a `GasScreen.tsx` stvarno
 * registruje `Readings` i `Analysis` — nijedan od ta tri cilja nije postojao, pa
 * URL deep link nikad nije mogao otvoriti ekran.
 *
 * Napomena: `myapp://gas/add-reading` se NE rješava preko ove konfiguracije nego
 * imperativno u `handleDeepLink` (notificationService), jer treba prenijeti
 * `openAddModal` parametar. Prefiksi ostaju `myapp://` — instalirane verzije ih
 * očekuju (MO2-2 version gate prije bilo kakve promjene).
 */
const linking: LinkingOptions<any> = {
  prefixes: [...DEEP_LINK_PREFIXES],
  config: {
    screens: {
      [ROOT_SCREENS.Main]: {
        screens: {
          [MAIN_TAB_SCREENS.Gas]: {
            screens: {
              [GAS_TAB_SCREENS.Readings]: 'readings',
              [GAS_TAB_SCREENS.Analysis]: 'analysis',
            },
          },
          [MAIN_TAB_SCREENS.Dashboard]: 'dashboard',
          [MAIN_TAB_SCREENS.Heating]: 'heating',
          [MAIN_TAB_SCREENS.Settings]: 'settings',
        },
      },
      [ROOT_SCREENS.Login]: 'login',
      [ROOT_SCREENS.Register]: 'register',
    },
  },
};

type RootNavigatorProps = {
  /**
   * MO2-3: poziva se kada je `NavigationContainer` spreman. `App.tsx` to koristi
   * da obradi cold-start notifikaciju — prije toga navigacija još ne postoji.
   */
  onReady?: () => void;
};

export const RootNavigator = React.forwardRef<NavigationContainerRef<any>, RootNavigatorProps>(
  ({ onReady }, ref) => {
    const { isAuthenticated, isLoading, restoreSession } = useAuth();
    const { colorMode } = useColorMode();

    // MO2-3 / MO-002: cold-start tap se smije obraditi samo jednom, i tek kad
    // je korisnik prijavljen. Dok nije, root stack sadrži samo Login/Register,
    // pa bi navigacija na `Main` pala kao "not handled".
    const coldStartHandled = React.useRef(false);

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

    const handleReady = () => {
      if (isAuthenticated && !coldStartHandled.current) {
        coldStartHandled.current = true;
        void handleColdStartNotification();
      }
      onReady?.();
    };

    return (
      <NavigationContainer
        ref={ref}
        theme={navigationTheme}
        linking={linking}
        onReady={handleReady}
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
              <Stack.Screen name={ROOT_SCREENS.Login} component={LoginScreen} />
              <Stack.Screen name={ROOT_SCREENS.Register} component={RegisterScreen} />
            </>
          ) : (
            // Main App Stack
            <>
              <Stack.Screen name={ROOT_SCREENS.Main} component={MainTabNavigator} />
              {/* Modal screens will be added here in future phases */}
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    );
  },
);
