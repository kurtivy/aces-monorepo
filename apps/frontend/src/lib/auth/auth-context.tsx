'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  ProfileApi,
  UserProfile,
  ProfileUpdateRequest,
  UserVerificationRequest,
} from '@/lib/api/profile';
import { VerificationApi, VerificationStatus } from '@/lib/api/verification';

// Utility to check if external wallets are actually connected
const checkExternalWalletConnection = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  try {
    // Check MetaMask/Ethereum wallets
    if (window.ethereum) {
      const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
      if (accounts && accounts.length > 0) {
        return true;
      }
    }

    // Check Phantom (Solana wallet)
    if ((window as any).solana && (window as any).solana.isPhantom) {
      const response = await (window as any).solana.connect({ onlyIfTrusted: true });
      if (response && response.publicKey) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
};

// Track ongoing connection requests to prevent duplicates
let connectionInProgress = false;

// Utility to request external wallet connection with proper permissions
const requestExternalWalletConnection = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (connectionInProgress) {
    return false;
  }

  try {
    connectionInProgress = true;

    // Request MetaMask/Ethereum wallet connection
    if (window.ethereum) {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (accounts && accounts.length > 0) {
        return true;
      }
    }

    // Request Phantom (Solana wallet) connection
    if ((window as any).solana && (window as any).solana.isPhantom) {
      const response = await (window as any).solana.connect();
      if (response && response.publicKey) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  } finally {
    connectionInProgress = false;
  }
};

// Re-export types for convenience
export type { UserProfile, ProfileUpdateRequest };

// Main auth context interface
interface AuthContextType {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  walletAddress: string | null;
  error: string | null;
  isVerifiedSeller: boolean;
  isAdmin: boolean;
  hasExternalWallet: boolean;

  // Actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshUserProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  applyForSeller: (formData: FormData) => Promise<boolean>;
  getVerificationStatus: () => Promise<VerificationStatus | null>;
  getAccessToken: () => Promise<string | null>;

  // Utility functions
  hasRole: (role: string | string[]) => boolean;
  isOwnerOf: (resourceOwnerId: string) => boolean;
  requiresExternalWallet: () => { required: boolean; message?: string };
}

const AuthContext = createContext<AuthContextType | null>(null);

// API Configuration - Fixed environment variable name
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Internal state interface (simpler, just what we actually use)
interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  hasExternalWallet: boolean;
}

// Custom hook to use auth context
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

  // Initialize auth state when Privy is ready (external wallet optional)
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
  }, [privyAuthenticated, privyUser]);

  const initializeAuth = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Get Privy access token
      const token = await privyGetAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }

      // Prepare user verification request
      const userVerificationRequest: UserVerificationRequest = {
        privyDid: privyUser?.id || '',
        walletAddress: privyUser?.wallet?.address || undefined,
        email: privyUser?.email?.address || undefined,
        displayName: privyUser?.email?.address?.split('@')[0] || 'User',
      };

      // Call backend to verify or create user
      const result = await ProfileApi.verifyOrCreateUser(userVerificationRequest, token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to verify user');
      }

      setState((prev) => ({
        ...prev,
        user: result.data.profile,
      }));
    } catch (error) {
      console.error('❌ Auth initialization error:', error);

      // Fallback: create local user profile if backend fails
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
  };

  // Optional: Load full user profile from backend (only when needed)
  const loadFullUserProfile = async () => {
    try {
      const token = await privyGetAccessToken();
      if (!token) throw new Error('No auth token available');
      const result = await ProfileApi.getCurrentProfile(token);

      if (result.success) {
        setState((prev) => ({
          ...prev,
          user: result.data,
        }));
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Error loading full user profile:', error);
      throw error instanceof Error ? error : new Error('Failed to load user profile');
    }
  };

  // Track connection attempts to prevent duplicates
  const [connectionAttempting, setConnectionAttempting] = useState(false);

  // Wallet Actions - Simplified to prioritize Privy
  const connectWallet = async () => {
    // Prevent multiple simultaneous connection attempts
    if (connectionAttempting) {
      return;
    }

    try {
      setConnectionAttempting(true);
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // If user is already authenticated with Privy, they're good to go
      if (privyAuthenticated && privyUser) {
        return;
      }

      // For new users, start with Privy login (which will show embedded wallet option first)
      await privyLogin();
    } catch (error) {
      console.error('❌ Connect wallet error:', error);

      // Handle embedded wallet HTTPS error specifically
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

      setState((prev) => ({
        ...prev,
        user: null,
        isLoading: false,
        hasExternalWallet: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to disconnect wallet',
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const refreshUserProfile = async () => {
    if (privyAuthenticated && privyUser) {
      // Re-initialize auth with current Privy data
      await initializeAuth();
    }
  };

  // Helper function to check if external wallet is required for transactions
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

  // Profile Actions
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

  // Verification Actions
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

  // Utility Functions
  const hasRole = (role: string | string[]): boolean => {
    if (!state.user) return false;
    const userRole = state.user.role;
    return Array.isArray(role) ? role.includes(userRole) : userRole === role;
  };

  const isOwnerOf = (resourceOwnerId: string): boolean => {
    return state.user?.id === resourceOwnerId;
  };

  // Context Value
  const contextValue: AuthContextType = {
    // Authentication state
    isAuthenticated: privyAuthenticated, // Show as authenticated immediately when Privy succeeds
    isAdmin,
    error: state.error,
    isLoading: state.isLoading,
    user: state.user,
    walletAddress: privyUser?.wallet?.address || null,
    isVerifiedSeller: state.user?.sellerStatus === 'APPROVED',
    hasExternalWallet: state.hasExternalWallet,

    // Actions
    connectWallet,
    disconnectWallet,
    refreshUserProfile,
    updateProfile,
    applyForSeller,
    getVerificationStatus,
    getAccessToken,

    // Utility functions
    hasRole,
    isOwnerOf,
    requiresExternalWallet,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
