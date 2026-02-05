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

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();

  const bgColor = useColorModeValue('gray.50', 'dark.900');
  const cardBg = useColorModeValue('white', 'dark.800');
  const textColor = useColorModeValue('gray.800', 'gray.100');

  const handleLogin = async () => {
    if (!email || !password) {
      toast.show({
        description: t('auth.fillAllFields'),
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.show({
        description: t('auth.welcomeBack'),
      });
    } catch (error: any) {
      console.error('Login error:', error);
      toast.show({
        description: error.response?.data?.message || t('auth.loginError'),
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
                {t('auth.smartHeating')}
              </Text>
            </VStack>

            {/* Login Form */}
            <Box w="100%" maxW="400px" bg={cardBg} rounded="xl" shadow={2} p={6}>
              <VStack space={4}>
                <Heading size="lg" color={textColor} mb={2}>
                  {t('auth.signIn')}
                </Heading>

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
                    onSubmitEditing={handleLogin}
                  />
                </VStack>

                <Button onPress={handleLogin} isLoading={isLoading} mt={2} size="lg">
                  {t('auth.signIn')}
                </Button>

                <HStack justifyContent="center" mt={4}>
                  <Text fontSize="sm" color="gray.500">
                    {t('auth.dontHaveAccount')}{' '}
                  </Text>
                  <Pressable onPress={() => navigation.navigate('Register')}>
                    <Text fontSize="sm" color="brand.400" fontWeight="semibold">
                      {t('auth.signUp')}
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
