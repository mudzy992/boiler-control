import { createStackNavigator } from '@react-navigation/stack';
import { useColorModeValue } from '../components/ui/nativewind';
import { useTranslation } from '../hooks/useTranslation';
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
  const { t } = useTranslation();

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
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="HomeManagement"
        component={HomeManagementScreen}
        options={{
          // F1 (nalaz UX-05): naslovi su prije bili engleski string literali ovdje,
          // pa je header ostajao nepreveden i kad je ekran preveden. Sada ekran
          // sam nosi `ScreenHeader` (nazad + naslov + akcija), pa je native
          // header isključen — inače bi se prikazala DVA headera.
          headerShown: false,
          title: t('homeManagement.title'),
          headerBackTitle: t('common.back'),
        }}
      />
      <Stack.Screen
        name="ScheduleManagement"
        component={ScheduleManagementScreen}
        options={{
          headerShown: false,
          title: t('schedule.title'),
          headerBackTitle: t('common.back'),
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
          title: t('notifications.title'),
          headerBackTitle: t('common.back'),
        }}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{
          headerShown: false,
          title: t('notifications.preferences'),
          headerBackTitle: t('common.back'),
        }}
      />
    </Stack.Navigator>
  );
};
