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
import { useTranslation } from '../../hooks/useTranslation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormInput } from '../../components/FormInput';

export const RegisterScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');

  const handleRegister = async () => {
    // Validation
    if (!name || !username || !email || !password || !confirmPassword) {
      toast.show({
        description: t('auth.fillAllFields'),
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.show({
        description: t('auth.passwordsDontMatch'),
      });
      return;
    }

    if (password.length < 6) {
      toast.show({
        description: t('auth.passwordTooShort'),
      });
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, name, username);
      toast.show({
        description: t('auth.accountCreated'),
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.show({
        description: error.response?.data?.message || t('auth.registerError'),
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
                {t('auth.appTitle')}
              </Heading>
              <Text fontSize="md" color="gray.500">
                {t('auth.createAccount')}
              </Text>
            </VStack>

            {/* Register Form */}
            <Box w="100%" maxW="400px" bg={cardBg} rounded="xl" shadow={2} p={6}>
              <VStack space={4}>
                <Heading size="lg" color={textColor} mb={2}>
                  {t('auth.signUp')}
                </Heading>

                <VStack space={2}>
                  <Text fontSize="sm" fontWeight="medium" color={textColor}>
                    {t('auth.name')}
                  </Text>
                  <FormInput
                    placeholder={t('auth.namePlaceholder')}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    isDisabled={isLoading}
                  />
                </VStack>

                <VStack space={2}>
                  <Text fontSize="sm" fontWeight="medium" color={textColor}>
                    {t('auth.email')}
                  </Text>
                  <FormInput
                    placeholder={t('auth.emailPlaceholder')}
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
                    {t('auth.username')}
                  </Text>
                  <FormInput
                    placeholder={t('auth.usernamePlaceholder')}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    isDisabled={isLoading}
                  />
                </VStack>

                <VStack space={2}>
                  <Text fontSize="sm" fontWeight="medium" color={textColor}>
                    {t('auth.password')}
                  </Text>
                  <FormInput
                    placeholder={t('auth.passwordPlaceholder')}
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
                    {t('auth.confirmPassword')}
                  </Text>
                  <FormInput
                    placeholder={t('auth.passwordPlaceholder')}
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
                  {t('auth.signUp')}
                </Button>

                <HStack justifyContent="center" mt={4}>
                  <Text fontSize="sm" color="gray.500">
                    {t('auth.alreadyHaveAccount')}{' '}
                  </Text>
                  <Pressable onPress={() => navigation.navigate('Login')}>
                    <Text fontSize="sm" color="brand.400" fontWeight="semibold">
                      {t('auth.signIn')}
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
