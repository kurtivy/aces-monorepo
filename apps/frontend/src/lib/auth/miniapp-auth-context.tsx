'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { UserProfile } from '@/lib/api/profile';

interface MiniAppAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  walletAddress: string | null;
  error: string | null;
  authReady: boolean;

  signIn: () => Promise<void>;
  signOut: () => void;
  refreshUserProfile: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const MiniAppAuthContext = createContext<MiniAppAuthContextType | null>(null);

function getAuthApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3002';
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const href = window.location.href;

    if (href.includes('git-dev') || hostname.includes('git-dev')) {
      return 'https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app';
    }
  }

  return 'https://acesbackend-production.up.railway.app';
}

const API_BASE_URL = getAuthApiBaseUrl();

export const useMiniAppAuth = (): MiniAppAuthContextType => {
  const context = useContext(MiniAppAuthContext);
  if (!context) {
    throw new Error('useMiniAppAuth must be used within a MiniAppAuthProvider');
  }
  return context;
};

export function MiniAppAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const signIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔐 [MiniApp] Getting Quick Auth token...');
      const { token: quickAuthToken } = await sdk.quickAuth.getToken();
      setToken(quickAuthToken);

      console.log('🔐 [MiniApp] Verifying token with backend...');
      const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
        headers: {
          Authorization: `Bearer ${quickAuthToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to verify authentication');
      }

      const data = await response.json();
      setUser(data.data);
      setAuthReady(true);

      console.log('✅ [MiniApp] Authentication successful');
    } catch (err) {
      console.error('❌ [MiniApp] Authentication failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthReady(false);
    setError(null);
  }, []);

  const refreshUserProfile = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh user profile');
      }

      const data = await response.json();
      setUser(data.data);
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh profile');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const getAccessToken = useCallback(async () => {
    return token;
  }, [token]);

  const contextValue: MiniAppAuthContextType = {
    isAuthenticated: !!token && !!user,
    isLoading,
    user,
    walletAddress: user?.walletAddress || null,
    error,
    authReady,
    signIn,
    signOut,
    refreshUserProfile,
    getAccessToken,
  };

  return (
    <MiniAppAuthContext.Provider value={contextValue}>{children}</MiniAppAuthContext.Provider>
  );
}
