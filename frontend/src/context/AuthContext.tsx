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

  // SEC-4: prije bilo čega pitamo backend da li je httpOnly refresh tok
  // uključen. Dok je zastavica off ovo samo postavi `false` i ponašanje je
  // identično prijašnjem.
  useEffect(() => {
    let cancelled = false;
    apiClient.detectAuthMode().then((enabled) => {
      if (cancelled || !enabled) return;
      // Nema tokena u localStorage, ali možda postoji httpOnly cookie iz
      // prethodne sesije — pokušaj tiho obnoviti umjesto da se korisnik
      // odmah prebaci na login.
      if (!localStorage.getItem('token')) {
        apiClient.refreshSession().then((ok) => {
          if (ok && !cancelled) setToken(localStorage.getItem('token'));
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    // SEC-4: server-side opoziv je fire-and-forget — lokalno stanje se čisti
    // odmah da UI ne čeka mrežu, a `apiClient.logout()` opoziva refresh
    // sesiju na backendu kad je tok uključen.
    void apiClient.logout();
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
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
