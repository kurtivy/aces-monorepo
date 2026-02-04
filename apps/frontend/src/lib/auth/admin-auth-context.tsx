'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { useAuthActions, useAuthToken } from '@convex-dev/auth/react';
import { api } from '../../../convex/_generated/api';

export interface AdminAuthResult {
  success: boolean;
  error?: string;
}

interface AdminAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AdminAuthResult>;
  signUp: (email: string, password: string) => Promise<AdminAuthResult>;
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
  const { signIn, signOut } = useAuthActions();
  const token = useAuthToken();
  const [error, setError] = React.useState<string | null>(null);

  const isAuthenticated = currentAdmin !== undefined && currentAdmin !== null;
  const isLoading = currentAdmin === undefined;

  const checkAuth = useCallback(() => {
    // Convex query drives state; no-op refetch is handled by Convex
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AdminAuthResult> => {
    try {
      setError(null);
      const res = await fetch('/api/admin/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error ?? 'Sign-in failed';
        setError(msg);
        return { success: false, error: msg };
      }
      if (data?.success) {
        return { success: true };
      }
      setError(data?.error ?? 'Sign-in did not complete.');
      return { success: false, error: data?.error ?? 'Sign-in did not complete.' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AdminAuthResult> => {
    try {
      setError(null);
      const res = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error ?? 'Sign-up failed';
        setError(msg);
        return { success: false, error: msg };
      }
      if (data?.success) {
        return { success: true };
      }
      setError(data?.error ?? 'Sign-up did not complete.');
      return {
        success: false,
        error:
          data?.error ??
          'Sign-up did not complete. Try again or use Sign in if you already have an account.',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-up failed';
      setError(message);
      return { success: false, error: message };
    }
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
    return token ?? null;
  }, [token]);

  const value: AdminAuthContextType = {
    isAuthenticated,
    isLoading,
    error,
    login,
    signUp,
    logout,
    checkAuth,
    getAdminAccessToken,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
