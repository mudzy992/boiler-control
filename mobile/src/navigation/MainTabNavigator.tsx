import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useColorMode } from 'native-base';
import { BackHandler } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';
import { DashboardStackNavigator } from './DashboardStackNavigator';
import { HeatingScreen } from '../screens/heating/HeatingScreen';
import { GasScreen } from '../screens/gas/GasScreen';
import { SettingsStackNavigator } from './SettingsStackNavigator';

// Polyfill for BackHandler compatibility with React Navigation 7.x and RN 0.81.5
if (typeof (BackHandler as any).removeEventListener !== 'function') {
  (BackHandler as any).removeEventListener = () => {};
}

const Tab = createBottomTabNavigator();

export const MainTabNavigator = () => {
  const { colorMode } = useColorMode();
  const { t } = useTranslation();

  const tabBarOptions = {
    activeTintColor: '#ff6b3d',
    inactiveTintColor: colorMode === 'dark' ? '#94a3b8' : '#6b7280',
    style: {
      backgroundColor: colorMode === 'dark' ? '#1e293b' : '#ffffff',
      borderTopColor: colorMode === 'dark' ? '#334155' : '#e5e7eb',
    },
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabBarOptions.activeTintColor,
        tabBarInactiveTintColor: tabBarOptions.inactiveTintColor,
        tabBarStyle: tabBarOptions.style,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNavigator}
        options={{
          tabBarLabel: t('navigation.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Heating"
        component={HeatingScreen}
        options={{
          tabBarLabel: t('navigation.heating'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Gas"
        component={GasScreen}
        options={{
          tabBarLabel: t('navigation.gas'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          tabBarLabel: t('navigation.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
