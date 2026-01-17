import { createContext } from "react";
import type { AuthUser } from "../api/auth.api";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>; // dohvat latest user podataka
  setUser: (user: AuthUser | null) => void; // direktni update user state
}

export const AuthContext =
  createContext<AuthContextValue | undefined>(undefined);
