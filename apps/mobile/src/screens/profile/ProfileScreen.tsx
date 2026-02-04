import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  useColorModeValue,
  Switch,
  Button,
  Divider,
  useColorMode,
  Pressable,
} from 'native-base';
import { useAuth } from '../../hooks/useAuth';

export const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const subtextColor = useColorModeValue('gray.600', 'gray.400');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <Box flex={1} bg={bgColor} safeArea>
      <VStack flex={1} px={4} py={6} space={4}>
        <Heading size="xl" color={textColor}>
          Profile
        </Heading>

        {/* User Info Card */}
        <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
          <VStack space={2}>
            <Text fontSize="lg" fontWeight="bold" color={textColor}>
              {user?.name}
            </Text>
            <Text fontSize="md" color={subtextColor}>
              {user?.email}
            </Text>
          </VStack>
        </Box>

        {/* Appearance Card */}
        <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
          <VStack space={3}>
            <Text fontSize="md" fontWeight="semibold" color={textColor}>
              Appearance
            </Text>
            <Divider />
            <HStack alignItems="center" justifyContent="space-between">
              <Text fontSize="md" color={textColor}>
                Dark Mode
              </Text>
              <Switch
                isChecked={colorMode === 'dark'}
                onToggle={toggleColorMode}
                colorScheme="brand"
              />
            </HStack>
          </VStack>
        </Box>

        {/* Coming Soon Card */}
        <Box bg={cardBg} rounded="xl" shadow={2} p={4}>
          <VStack space={3}>
            <Text fontSize="md" fontWeight="semibold" color={textColor}>
              Coming Soon
            </Text>
            <Divider />
            <VStack space={2}>
              <Pressable opacity={0.5}>
                <Text fontSize="md" color={subtextColor}>
                  • Home Profile Settings
                </Text>
              </Pressable>
              <Pressable opacity={0.5}>
                <Text fontSize="md" color={subtextColor}>
                  • Notification Preferences
                </Text>
              </Pressable>
              <Pressable opacity={0.5}>
                <Text fontSize="md" color={subtextColor}>
                  • Account Settings
                </Text>
              </Pressable>
            </VStack>
          </VStack>
        </Box>

        {/* Logout Button */}
        <Button onPress={handleLogout} colorScheme="red" variant="outline" mt={4}>
          Sign Out
        </Button>

        {/* App Version */}
        <Text fontSize="xs" color="gray.400" textAlign="center" mt={4}>
          Boiler Control Mobile v2.0.0
        </Text>
      </VStack>
    </Box>
  );
};
