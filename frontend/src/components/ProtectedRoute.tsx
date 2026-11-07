import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { QueryState } from '@/shared/components/query-state';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { token, isInitializing } = useAuth();

  /**
   * FE2-2: dok se auth tok otkriva i sesija tiho obnavlja, NE preusmjeravamo.
   * Čeka se samo kad tokena NEMA.
   */
  if (!token && isInitializing) {
    return <QueryState status="loading" />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
