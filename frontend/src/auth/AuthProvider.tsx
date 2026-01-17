import { type ReactNode, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { getMe, logout as apiLogout, login as apiLogin, type AuthUser } from "../api/auth.api";

interface Props {
  children: ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // inicijalni load user-a
  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (active) setInitialized(true);
        return;
      }

      if (active) setLoading(true);

      try {
        const me = await getMe();
        if (active) setUser(me);
      } catch {
        apiLogout();
        if (active) setUser(null);
      } finally {
        if (active) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initAuth();

    return () => { active = false; };
  }, []);

  // login
  const loginHandler = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiLogin({ email, password });
      localStorage.setItem("token", res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  // logout
  const logoutHandler = () => {
    apiLogout();
    setUser(null);
  };

  // refresh user podataka (npr. posle update profila)
  const refreshUser = async () => {
    setLoading(true);
    try {
      const me = await getMe();
      setUser(me);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initialized,
        login: loginHandler,
        logout: logoutHandler,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
