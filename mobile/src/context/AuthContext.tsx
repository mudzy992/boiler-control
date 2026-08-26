import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Platform } from 'react-native';
import { apiClient } from '../services/api/client';
import { SecureStorage } from '../services/storage/SecureStorage';
import { registerForPushNotifications } from '../services/notifications/notificationService';

export interface User {
  id: number;
  email: string;
  username?: string | null;
  name: string;
  gasPriceExVat?: number | null;
  gasPriceIncVat?: number | null;
  gasPriceLastUpdatedAt?: string | null;
  gasPriceSource?: string | null;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    username: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedToken = await SecureStorage.getToken();

      if (savedToken) {
        setToken(savedToken);
        await apiClient.setToken(savedToken);

        // Fetch user profile
        try {
          const userData = await apiClient.getMe();
          setUser(userData);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          // Token might be invalid, clear it
          await logout();
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const response = await apiClient.login(identifier, password);

      if (!response.token) {
        throw new Error('No token received from server');
      }

      setToken(response.token);
      setUser(response.user);
      await SecureStorage.setToken(response.token);
      await apiClient.setToken(response.token);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      username: string,
    ) => {
      try {
        const response = await apiClient.register(
          email,
          password,
          name,
          username,
        );

        if (!response.token) {
          throw new Error('No token received from server');
        }

        setToken(response.token);
        setUser(response.user);
        await SecureStorage.setToken(response.token);
        await apiClient.setToken(response.token);
      } catch (error) {
        console.error('Registration failed:', error);
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      setUser(null);
      setToken(null);
      await SecureStorage.removeToken();
      await apiClient.clearToken();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    restoreSession,
    setUser,
  };

  useEffect(() => {
    const registerPushToken = async () => {
      if (!token) return;

      try {
        const result = await registerForPushNotifications();
        if (!result.token) return;

        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        await apiClient.registerPushToken(result.token, platform);
      } catch (error) {
        console.warn('Push notification registration failed:', error);
      }
    };

    registerPushToken();
  }, [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
