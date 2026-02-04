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

export const RegisterScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const toast = useToast();

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');

  const handleRegister = async () => {
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      toast.show({
        description: 'Please fill in all fields',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.show({
        description: 'Passwords do not match',
      });
      return;
    }

    if (password.length < 6) {
      toast.show({
        description: 'Password must be at least 6 characters',
      });
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, name);
      toast.show({
        description: 'Account created successfully!',
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.show({
        description: error.response?.data?.message || 'Registration failed. Please try again.',
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
                Create your account
              </Text>
            </VStack>

            {/* Register Form */}
            <Box w="100%" maxW="400px" bg={cardBg} rounded="xl" shadow={2} p={6}>
              <VStack space={4}>
                <Heading size="lg" color={textColor} mb={2}>
                  Sign Up
                </Heading>

                <VStack space={2}>
                  <Text fontSize="sm" fontWeight="medium" color={textColor}>
                    Full Name
                  </Text>
                  <FormInput
                    placeholder="John Doe"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    isDisabled={isLoading}
                  />
                </VStack>

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
                    placeholder="At least 6 characters"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    isDisabled={isLoading}
                  />
                </VStack>

                <VStack space={2}>
                  <Text fontSize="sm" fontWeight="medium" color={textColor}>
                    Confirm Password
                  </Text>
                  <FormInput
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    isDisabled={isLoading}
                    onSubmitEditing={handleRegister}
                  />
                </VStack>

                <Button onPress={handleRegister} isLoading={isLoading} mt={2} size="lg">
                  Create Account
                </Button>

                <HStack justifyContent="center" mt={4}>
                  <Text fontSize="sm" color="gray.500">
                    Already have an account?{' '}
                  </Text>
                  <Pressable onPress={() => navigation.navigate('Login')}>
                    <Text fontSize="sm" color="brand.400" fontWeight="semibold">
                      Sign In
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
