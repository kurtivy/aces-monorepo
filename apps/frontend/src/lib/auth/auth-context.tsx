'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ProfileApi, UserProfile, ProfileUpdateRequest } from '@/lib/api/profile';
import { VerificationApi, VerificationStatus } from '@/lib/api/verification';

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
}

const AuthContext = createContext<AuthContextType | null>(null);

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Internal state interface (simpler, just what we actually use)
interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
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
  });

  const isAdmin = state.user?.role === 'ADMIN';

  // Initialize auth state when Privy is ready
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
      await loadUserProfile();
    } catch (error) {
      console.error('Auth initialization error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const loadUserProfile = async () => {
    try {
      const token = await privyGetAccessToken();
      if (!token) throw new Error('No auth token available');

      const result = await ProfileApi.getCurrentProfile(token);

      if (result.success) {
        setState((prev) => ({
          ...prev,
          user: result.data,
        }));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      throw error instanceof Error ? error : new Error('Failed to load user profile');
    }
  };

  // Wallet Actions
  const connectWallet = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      await privyLogin();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
      }));
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
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
      await loadUserProfile();
    }
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

      const response = await fetch(`${API_BASE_URL}/api/v1/seller-verification/submit`, {
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
    isAuthenticated: privyAuthenticated,
    isAdmin,
    error: state.error,
    isLoading: state.isLoading,
    user: state.user,
    walletAddress: privyUser?.wallet?.address || null,
    isVerifiedSeller: state.user?.sellerStatus === 'APPROVED',

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
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
