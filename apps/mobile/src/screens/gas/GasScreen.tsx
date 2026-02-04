import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorModeValue } from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import { GasReadingsScreen } from './GasReadingsScreen';
import { GasAnalysisScreen } from './GasAnalysisScreen';

const Tab = createBottomTabNavigator();

export const GasScreen = () => {
  const headerBg = useColorModeValue('#ffffff', '#1a202c');
  const headerTint = useColorModeValue('#000000', '#ffffff');
  const tabBg = useColorModeValue('#ffffff', '#1a202c');
  const inactiveTint = useColorModeValue('#9ca3af', '#6b7280');
  const activeTint = useColorModeValue('#f97316', '#fb923c');

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: headerBg,
        },
        headerTintColor: headerTint,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: useColorModeValue('#e5e7eb', '#374151'),
        },
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
      }}
    >
      <Tab.Screen
        name="GasReadings"
        component={GasReadingsScreen}
        options={{
          title: 'Readings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="GasAnalysis"
        component={GasAnalysisScreen}
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
