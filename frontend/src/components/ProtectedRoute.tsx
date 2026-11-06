import React from 'react';
import { useAuth } from '../features/auth/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { token, isInitializing } = useAuth();

  /**
   * FE2-2: dok se auth tok otkriva i sesija tiho obnavlja, NE preusmjeravamo.
   *
   * Prije ove izmjene komponenta je gledala samo `!token`. S tokenom u
   * memoriji (`api.ts`) reload stranice znači da tokena pri prvom renderu
   * nema, iako je httpOnly refresh cookie ispravan — korisnik bi bio izbačen
   * na `/login` usred sesije. To je nalaz FE-002: postojanje stringa nikad
   * nije bilo dokaz sesije.
   *
   * `isInitializing` je `true` samo tokom `detectAuthMode()` (+ opciono
   * `refreshSession()`), pa je ovo prolazno stanje od jednog mrežnog poziva.
   */
  /**
   * Čeka se samo kad tokena NEMA. Kad token postoji (npr. `off` tok, gdje se
   * čita iz `localStorage` pri prvom renderu), sadržaj se prikazuje odmah —
   * bez treperenja i bez promjene prijašnjeg ponašanja.
   */
  if (!token && isInitializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
