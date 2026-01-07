import { createContext } from "react";
import type { AuthUser } from "../api/auth.api";
export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
}

export const AuthContext =
  createContext<AuthContextValue | undefined>(undefined);
