import { createContext } from "react";
import type { AuthUser } from "../api/auth.api";
export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  logout: () => void;
  login: (email: string, password: string) => Promise<void>;
}


export const AuthContext =
  createContext<AuthContextValue | undefined>(undefined);
