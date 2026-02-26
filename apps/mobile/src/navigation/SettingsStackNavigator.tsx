import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColorModeValue } from 'native-base';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { HomeManagementScreen } from '../screens/home/HomeManagementScreen';
import { ScheduleManagementScreen } from '../screens/schedule/ScheduleManagementScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { NotificationPreferencesScreen } from '../screens/notifications/NotificationPreferencesScreen';

const Stack = createStackNavigator();

export const SettingsStackNavigator = () => {
  const headerBg = useColorModeValue('#ffffff', '#1a202c');
  const headerTint = useColorModeValue('#000000', '#ffffff');

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: headerBg,
        },
        headerTintColor: headerTint,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="HomeManagement"
        component={HomeManagementScreen}
        options={{
          title: 'Manage Homes',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="ScheduleManagement"
        component={ScheduleManagementScreen}
        options={{
          title: 'Heating Schedules',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{
          title: 'Notification Preferences',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
};
