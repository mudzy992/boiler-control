import React, { createContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { apiClient } from '../../services/api';
import { mapAuthUser, type AuthUser } from './map-auth-user';

export type { AuthUser as User } from './map-auth-user';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  /**
   * FE2-2: `true` dok se provjerava auth tok i pokušava tiho obnavljanje sesije.
   *
   * Bez ovoga `ProtectedRoute` vidi `token === null` pri svakom reloadu i
   * prebaci prijavljenog korisnika na `/login` iako mu je httpOnly refresh
   * cookie sasvim ispravan — token više nije u `localStorage`, pa ga pri prvom
   * renderu jednostavno nema. To je nalaz FE-002 („ProtectedRoute vjeruje
   * postojanju stringa\"): postojanje stringa nikad nije bio dokaz sesije, a
   * sada nije ni njegov izostanak dokaz da sesije nema.
   */
  isInitializing: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  /**
   * FE2-2: početna vrijednost se čita preko `apiClient.getToken()`, koji
   * poštuje zastavicu. Pri prvom renderu zastavica još nije otkrivena
   * (`detectAuthMode` je asinhron), pa se čita `localStorage` — što je tačno
   * prijašnje ponašanje. Kad se ispostavi da je cookie tok uključen, efekt
   * ispod zamjenjuje vrijednost onom iz memorije.
   */
  const [token, setToken] = useState<string | null>(() => apiClient.getToken());
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  /**
   * SEC-4/FE2-2: prije bilo čega pitamo backend da li je httpOnly refresh tok
   * uključen. Dok je zastavica off ovo samo postavi `false`, `isInitializing`
   * se odmah gasi i ponašanje je identično prijašnjem.
   */
  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setIsInitializing(false);
    };

    apiClient.detectAuthMode().then((enabled) => {
      if (cancelled) return;
      if (!enabled) {
        finish();
        return;
      }
      // FE2-2: token je u memoriji, pa ga nakon reloada nema. Ako postoji
      // httpOnly cookie iz prethodne sesije, obnovi sesiju tiho umjesto da se
      // korisnik prebaci na login.
      if (apiClient.getToken()) {
        setToken(apiClient.getToken());
        finish();
        return;
      }
      apiClient.refreshSession().then((ok) => {
        if (cancelled) return;
        if (ok) setToken(apiClient.getToken());
        finish();
      });
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
      .then((profile) => setUser(mapAuthUser(profile as Record<string, unknown>)))
      .catch(() => {
        setToken(null);
        setUser(null);
        // FE2-2: čisti i memoriju i localStorage, bez obzira na aktivan tok.
        apiClient.clearToken();
      });
  }, [token]);

  const login = useCallback(async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiClient.login(identifier, password);
      setToken(data.token);
      setUser(mapAuthUser((data.user ?? {}) as Record<string, unknown>));
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
    // FE2-2: `apiClient.logout()` već zove `clearToken()`, ali on je
    // fire-and-forget — ovo čisti lokalno stanje odmah, ne tek kad mreža
    // odgovori.
    apiClient.clearToken();
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isInitializing,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
