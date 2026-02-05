import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useColorModeValue } from 'native-base';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';

const Stack = createStackNavigator();

export const DashboardStackNavigator = () => {
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
        name="DashboardMain"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};
