'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { useAuthActions, useAuthToken } from '@convex-dev/auth/react';
import { api } from '../../../convex/_generated/api';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /** Current JWT (from Convex Auth). Use for Bearer in API calls. */
  adminAuthToken: string | null;
  logout: () => Promise<void>;
  checkAuth: () => void;
  getAdminAccessToken: () => Promise<string | null>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const currentAdmin = useQuery(api.admin.getCurrentAdmin);
  const { signOut } = useAuthActions();
  const token = useAuthToken();
  const [error, setError] = React.useState<string | null>(null);

  const isAuthenticated = currentAdmin !== undefined && currentAdmin !== null;

  const isLoading = currentAdmin === undefined || (token === undefined && currentAdmin === null);

  const checkAuth = useCallback(() => {
    // Convex query drives state; no-op refetch is handled by Convex
  }, []);

  const logout = useCallback(async () => {
    try {
      setError(null);
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  }, [signOut]);

  const getAdminAccessToken = useCallback(async (): Promise<string | null> => {
    if (token && token.trim().length > 0) return token;
    try {
      const res = await fetch('/api/admin/session', { method: 'GET', credentials: 'same-origin' });
      const data = await res.json().catch(() => null);
      if (
        res.ok &&
        data?.success &&
        typeof data?.token === 'string' &&
        data.token.trim().length > 0
      ) {
        return data.token;
      }
    } catch {
      // ignore
    }
    return null;
  }, [token]);

  const value: AdminAuthContextType = {
    isAuthenticated,
    isLoading,
    error,
    adminAuthToken: token ?? null,
    logout,
    checkAuth,
    getAdminAccessToken,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
