'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  ProfileApi,
  UserProfile,
  ProfileUpdateRequest,
  UserVerificationRequest,
} from '@/lib/api/profile';
import { VerificationApi, VerificationStatus } from '@/lib/api/verification';

export type { UserProfile, ProfileUpdateRequest };

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  walletAddress: string | null;
  error: string | null;
  isVerifiedSeller: boolean;
  isAdmin: boolean;
  hasExternalWallet: boolean;

  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshUserProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  applyForSeller: (formData: FormData) => Promise<boolean>;
  getVerificationStatus: () => Promise<VerificationStatus | null>;
  getAccessToken: () => Promise<string | null>;

  hasRole: (role: string | string[]) => boolean;
  isOwnerOf: (resourceOwnerId: string) => boolean;
  requiresExternalWallet: () => { required: boolean; message?: string };
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates')
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  hasExternalWallet: boolean;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    authenticated: privyAuthenticated,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken: privyGetAccessToken,
  } = usePrivy();

  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: false,
    error: null,
    hasExternalWallet: false,
  });

  const isAdmin = state.user?.role === 'ADMIN';

  const initializeAuth = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      console.log('Initializing auth for user:', {
        privyId: privyUser?.id,
        email: privyUser?.email?.address,
        walletAddress: privyUser?.wallet?.address,
      });

      const token = await privyGetAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }

      const userVerificationRequest: UserVerificationRequest = {
        privyDid: privyUser?.id || '',
        walletAddress: privyUser?.wallet?.address || undefined,
        email: privyUser?.email?.address || undefined,
        displayName: privyUser?.email?.address?.split('@')[0] || 'User',
      };

      const result = await ProfileApi.verifyOrCreateUser(userVerificationRequest, token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to verify user');
      }

      console.log('User verification successful:', {
        id: result.data.profile.id,
        email: result.data.profile.email,
        role: result.data.profile.role,
        privyDid: result.data.profile.privyDid,
        created: result.data.created,
      });

      setState((prev) => ({
        ...prev,
        user: result.data.profile,
      }));
    } catch (error) {
      console.error('Auth initialization error:', error);

      const fallbackProfile: UserProfile = {
        id: privyUser?.id || '',
        privyDid: privyUser?.id || '',
        walletAddress: privyUser?.wallet?.address || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        email: privyUser?.email?.address || null,
        role: 'TRADER',
        isActive: true,
        firstName: null,
        lastName: null,
        displayName: privyUser?.email?.address?.split('@')[0] || 'User',
        avatar: null,
        bio: null,
        website: null,
        twitterHandle: null,
        sellerStatus: 'NOT_APPLIED',
        appliedAt: null,
        verifiedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        notifications: true,
        newsletter: true,
        darkMode: false,
      };

      setState((prev) => ({
        ...prev,
        user: fallbackProfile,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [privyUser, privyGetAccessToken]);

  useEffect(() => {
    if (privyAuthenticated && privyUser) {
      initializeAuth();
    } else {
      setState((prev) => ({
        ...prev,
        user: null,
        isLoading: false,
      }));
    }
  }, [privyAuthenticated, privyUser, initializeAuth]);

  const [connectionAttempting, setConnectionAttempting] = useState(false);

  const connectWallet = async () => {
    if (connectionAttempting) {
      return;
    }

    try {
      setConnectionAttempting(true);
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      if (privyAuthenticated && privyUser) {
        return;
      }

      await privyLogin();
    } catch (error) {
      console.error('Connect wallet error:', error);

      let errorMessage = 'Failed to connect wallet';
      if (error instanceof Error) {
        if (error.message.includes('Embedded wallet is only available over HTTPS')) {
          errorMessage = 'Please use an external wallet like MetaMask or Coinbase Wallet';
        } else {
          errorMessage = error.message;
        }
      }

      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
      setConnectionAttempting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      await privyLogout();

      localStorage.removeItem('sellerCredentials');
      localStorage.removeItem('privy:token');
      localStorage.removeItem('privy:refresh_token');

      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('privy:') || key.startsWith('auth:') || key.startsWith('wallet:'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      setState({
        user: null,
        isLoading: false,
        hasExternalWallet: false,
        error: null,
      });

      console.log('Cleared all authentication and cached data');
    } catch (error) {
      console.error('Disconnect error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to disconnect wallet',
        isLoading: false,
      }));
    }
  };

  const refreshUserProfile = useCallback(async () => {
    if (privyAuthenticated && privyUser) {
      await initializeAuth();
    }
  }, [privyAuthenticated, privyUser, initializeAuth]);

  const requiresExternalWallet = (): { required: boolean; message?: string } => {
    if (!state.hasExternalWallet) {
      return {
        required: true,
        message:
          'An external wallet (MetaMask, Phantom, etc.) is required for this transaction. Please connect your wallet first.',
      };
    }
    return { required: false };
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const token = await privyGetAccessToken();
      if (!token) throw new Error('No auth token available');

      const walletAddress = privyUser?.wallet?.address || '';

      const result = await ProfileApi.updateProfile(data, token, walletAddress);

      if (result.success) {
        setState((prev) => ({ ...prev, user: { ...prev.user, ...data } as UserProfile }));
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      setState((prev) => ({ ...prev, error: errorMessage }));
      return { success: false, error: errorMessage };
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const applyForSeller = async (applicationData: FormData): Promise<boolean> => {
    if (!privyAuthenticated || !privyUser) {
      throw new Error('User not authenticated');
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const token = await privyGetAccessToken();
      if (!token) throw new Error('No auth token available');

      const walletAddress = privyUser?.wallet?.address || '';

      const response = await fetch(`${API_BASE_URL}/api/v1/account-verification/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-wallet-address': walletAddress,
        },
        body: applicationData,
      });

      if (response.ok) {
        await refreshUserProfile();
        return true;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit verification');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit verification';
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const getVerificationStatus = async (): Promise<VerificationStatus | null> => {
    if (!privyAuthenticated || !privyUser) {
      return null;
    }

    try {
      const token = await privyGetAccessToken();
      if (!token) return null;

      const result = await VerificationApi.getVerificationStatus(token);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error getting verification status:', error);
      return null;
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    if (!privyAuthenticated || !privyUser) {
      return null;
    }

    try {
      const token = await privyGetAccessToken();
      return token;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  const hasRole = (role: string | string[]): boolean => {
    if (!state.user) return false;
    const userRole = state.user.role;
    return Array.isArray(role) ? role.includes(userRole) : userRole === role;
  };

  const isOwnerOf = (resourceOwnerId: string): boolean => {
    return state.user?.id === resourceOwnerId;
  };

  const contextValue: AuthContextType = {
    isAuthenticated: privyAuthenticated,
    isAdmin,
    error: state.error,
    isLoading: state.isLoading,
    user: state.user,
    walletAddress: privyUser?.wallet?.address || null,
    isVerifiedSeller: state.user?.sellerStatus === 'APPROVED',
    hasExternalWallet: state.hasExternalWallet,

    connectWallet,
    disconnectWallet,
    refreshUserProfile,
    updateProfile,
    applyForSeller,
    getVerificationStatus,
    getAccessToken,

    hasRole,
    isOwnerOf,
    requiresExternalWallet,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
