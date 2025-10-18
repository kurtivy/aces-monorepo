'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
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

function getAuthApiBaseUrl(): string {
  // Use environment variable if available
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // For localhost development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3002';
  }

  // Dynamic URL based on current deployment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const href = window.location.href;

    // Check for dev/git-dev branch
    if (href.includes('git-dev') || hostname.includes('git-dev')) {
      return 'https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app';
    }
  }

  // Production fallback (main branch and aces.fun)
  return 'https://acesbackend-production.up.railway.app';
}

const API_BASE_URL = getAuthApiBaseUrl();

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
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
    ready: privyReady,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    linkWallet: privyLinkWallet,
    connectWallet: privyConnectWallet,
    getAccessToken: privyGetAccessToken,
  } = usePrivy();
  const { wallets } = useWallets();

  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: false,
    error: null,
  });

  const externalEthereumWallet = useMemo(
    () =>
      wallets.find(
        (wallet) =>
          wallet.type === 'ethereum' &&
          wallet.walletClientType !== 'privy' &&
          wallet.walletClientType !== 'privy-v2',
      ) || null,
    [wallets],
  );

  const primaryWalletAddress = useMemo(() => {
    if (externalEthereumWallet) {
      return externalEthereumWallet.address;
    }

    const fallbackEthereumWallet = wallets.find((wallet) => wallet.type === 'ethereum');
    if (fallbackEthereumWallet) {
      return fallbackEthereumWallet.address;
    }

    return privyUser?.wallet?.address || null;
  }, [externalEthereumWallet, wallets, privyUser]);

  const hasExternalWalletConnected = Boolean(externalEthereumWallet);

  const isAdmin = state.user?.role === 'ADMIN';

  const initializeAuth = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const token = await privyGetAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }

      const userVerificationRequest: UserVerificationRequest = {
        privyDid: privyUser?.id || '',
        walletAddress: primaryWalletAddress || undefined,
        email: privyUser?.email?.address || undefined,
        username: privyUser?.email?.address?.split('@')[0] || undefined,
      };

      const result = await ProfileApi.verifyOrCreateUser(userVerificationRequest, token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to verify user');
      }

      setState((prev) => ({
        ...prev,
        user: result.data.profile,
      }));
    } catch (error) {
      console.error('Auth initialization error:', error);

      const fallbackProfile: UserProfile = {
        id: privyUser?.id || '',
        privyDid: privyUser?.id || '',
        walletAddress: primaryWalletAddress,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        email: privyUser?.email?.address || null,
        role: 'TRADER',
        isActive: true,
        firstName: null,
        lastName: null,
        username:
          privyUser?.email?.address?.split('@')[0] ||
          privyUser?.wallet?.address?.slice(2, 9).toUpperCase() ||
          null,
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
  }, [privyUser, privyGetAccessToken, primaryWalletAddress]);

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
      if (!privyReady) {
        throw new Error('Wallet is still initializing. Please try again.');
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const wasAuthenticated = privyAuthenticated;

      if (!privyAuthenticated) {
        // Use login() for initial authentication (embedded wallet will be created)
        await privyLogin();
        // Don't clear loading state here - let the useEffect handle it
        // The useEffect will trigger initializeAuth when privyAuthenticated becomes true
        return;
      } else {
        // Use linkWallet() to add additional wallets when already authenticated
        await privyLinkWallet();
      }

      // Only clear loading for linkWallet flow (not for initial login)
      if (wasAuthenticated) {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
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
        isLoading: false,
      }));
    } finally {
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
    if (!hasExternalWalletConnected) {
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

      const walletAddressForProfile = primaryWalletAddress || privyUser?.wallet?.address || '';

      const result = await ProfileApi.updateProfile(data, token, walletAddressForProfile);

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

      const walletAddressForProfile = primaryWalletAddress || privyUser?.wallet?.address || '';

      const response = await fetch(`${API_BASE_URL}/api/v1/account-verification/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-wallet-address': walletAddressForProfile,
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
    walletAddress: primaryWalletAddress,
    isVerifiedSeller: state.user?.sellerStatus === 'APPROVED',
    hasExternalWallet: hasExternalWalletConnected,

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
