'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInAdmin,
  signOutAdmin,
  isAdminAuthenticated,
  type AdminAuthResult,
} from '@/lib/supabase/admin-auth';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AdminAuthResult>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const authenticated = await isAdminAuthenticated();
      setIsAuthenticated(authenticated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication check failed');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<AdminAuthResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await signInAdmin(email, password);

      if (result.success) {
        setIsAuthenticated(true);
      } else {
        setError(result.error || 'Login failed');
        setIsAuthenticated(false);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Login failed';
      setError(error);
      setIsAuthenticated(false);
      return {
        success: false,
        error,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await signOutAdmin();
      setIsAuthenticated(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const value: AdminAuthContextType = {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
