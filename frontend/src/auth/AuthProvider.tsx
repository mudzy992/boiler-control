import { type ReactNode, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { getMe, logout as apiLogout, type AuthUser } from "../api/auth.api";

interface Props {
  children: ReactNode;
}

export const AuthProvider = ({ children }: Props) => {
  const hasToken = !!localStorage.getItem("token");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(hasToken);

  useEffect(() => {
    if (!hasToken) return;

    let active = true;

    getMe()
      .then((user) => active && setUser(user))
      .catch(() => {
        apiLogout();
        if (active) setUser(null);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [hasToken]);

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
