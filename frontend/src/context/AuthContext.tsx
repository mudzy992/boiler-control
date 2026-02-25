import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { apiClient } from '../services/api';

interface User {
  id: string;
  email: string;
  username?: string | null;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('token')
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    apiClient.setToken(token);
    apiClient
      .getUserProfile()
      .then((profile) => setUser(profile))
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
      });
  }, [token]);

  const login = useCallback(async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiClient.login(identifier, password);
      setToken(data.token);
      setUser(data.user);
      apiClient.setToken(data.token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    apiClient.clearToken();
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
