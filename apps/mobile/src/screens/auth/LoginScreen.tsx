import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Button,
  Text,
  useColorModeValue,
  useToast,
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
} from 'native-base';
import { Platform } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormInput } from '../../components/FormInput';

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const toast = useToast();

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');

  const handleLogin = async () => {
    if (!email || !password) {
      toast.show({
        description: 'Please fill in all fields',
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.show({
        description: 'Welcome back!',
      });
    } catch (error: any) {
      console.error('Login error:', error);
      toast.show({
        description:
          error.response?.data?.message || 'Login failed. Please check your credentials.',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView flex={1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView flex={1} bg={bgColor} contentContainerStyle={{ flexGrow: 1 }}>
        <Box flex={1} px={6} py={8} justifyContent="center">
          <VStack space={8} alignItems="center">
            {/* App Logo/Icon */}
            <VStack space={3} alignItems="center">
              <Box bg="brand.400" rounded="full" p={4} shadow={3}>
                <MaterialCommunityIcons name="fire" size={48} color="white" />
              </Box>
              <Heading size="xl" color={textColor}>
                Boiler Control
              </Heading>
              <Text fontSize="md" color="gray.500">
                Smart heating management
              </Text>
            </VStack>

            {/* Login Form */}
            <Box w="100%" maxW="400px" bg={cardBg} rounded="xl" shadow={2} p={6}>
              <VStack space={4}>
                <Heading size="lg" color={textColor} mb={2}>
                  Sign In
                </Heading>

                <VStack space={2}>
                  <Text fontSize="sm" fontWeight="medium" color={textColor}>
                    Email
                  </Text>
                  <FormInput
                    placeholder="your@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    isDisabled={isLoading}
                  />
                </VStack>

                <VStack space={2}>
                  <Text fontSize="sm" fontWeight="medium" color={textColor}>
                    Password
                  </Text>
                  <FormInput
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    isDisabled={isLoading}
                    onSubmitEditing={handleLogin}
                  />
                </VStack>

                <Button onPress={handleLogin} isLoading={isLoading} mt={2} size="lg">
                  Sign In
                </Button>

                <HStack justifyContent="center" mt={4}>
                  <Text fontSize="sm" color="gray.500">
                    Don't have an account?{' '}
                  </Text>
                  <Pressable onPress={() => navigation.navigate('Register')}>
                    <Text fontSize="sm" color="brand.400" fontWeight="semibold">
                      Sign Up
                    </Text>
                  </Pressable>
                </HStack>
              </VStack>
            </Box>
          </VStack>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
