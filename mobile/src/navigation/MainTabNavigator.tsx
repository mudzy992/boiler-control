import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../hooks/useTranslation';
import { useTokens } from '../ui/theme';
import { DashboardStackNavigator } from './DashboardStackNavigator';
import { HeatingScreen } from '../screens/heating/HeatingScreen';
import { GasScreen } from '../screens/gas/GasScreen';
import { SettingsStackNavigator } from './SettingsStackNavigator';

const Tab = createBottomTabNavigator();

/**
 * Glavna traka — jedina traka u aplikaciji (F1, nalaz UX-03).
 *
 * Prije: boje su bile hardkodovani hex literali (`#ff6b3d`, `#1e293b`, ...) uz
 * `useColorMode`, dakle van token sistema; Plin je unutar sebe imao DRUGI tab
 * bar, pa su dvije trake trošile ~112px visine na 800px ekrana.
 *
 * Sada: sve boje i mjere iz `useTokens()`, a visina poštuje safe-area inset
 * (iOS notch / Android geste) umjesto fiksnih 49px.
 */
export const MainTabNavigator = () => {
  const { t } = useTranslation();
  const { t: tokens, fonts } = useTokens();
  const insets = useSafeAreaInsets();

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.signal,
        tabBarInactiveTintColor: tokens.inkDim,
        tabBarStyle: {
          backgroundColor: tokens.panel,
          borderTopColor: tokens.line,
          borderTopWidth: 1,
          height: 56 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        tabBarIconStyle: { marginBottom: 0 },
        // Ikonice dobijaju ime taba kao a11y labelu; bez toga TalkBack čita
        // samo naziv ikonice iz fonta.
        tabBarAccessibilityLabel: undefined,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNavigator}
        options={{
          tabBarLabel: t('navigation.dashboard'),
          tabBarAccessibilityLabel: t('navigation.dashboard'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'speedometer' : 'speedometer-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Heating"
        component={HeatingScreen}
        options={{
          tabBarLabel: t('navigation.heating'),
          tabBarAccessibilityLabel: t('navigation.heating'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flame' : 'flame-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Gas"
        component={GasScreen}
        options={{
          tabBarLabel: t('navigation.gas'),
          tabBarAccessibilityLabel: t('navigation.gas'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'analytics' : 'analytics-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          tabBarLabel: t('navigation.settings'),
          tabBarAccessibilityLabel: t('navigation.settings'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
