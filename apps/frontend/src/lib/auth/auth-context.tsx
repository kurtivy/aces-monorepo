'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ProfileApi, UserProfile, ProfileUpdateRequest } from '@/lib/api/profile';
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
    console.log('No external wallet connected:', error);
    return false;
  }
};

// Track ongoing connection requests to prevent duplicates
let connectionInProgress = false;

// Utility to request external wallet connection with proper permissions
const requestExternalWalletConnection = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (connectionInProgress) {
    console.log('🔄 Connection already in progress, skipping...');
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
    console.log('Failed to request external wallet connection:', error);
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

  // Monitor external wallet disconnection with improved race condition handling
  // TEMPORARILY DISABLED - Enable this later once core auth is working
  /*
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
          
          // Only disconnect if both conditions are true:
          // 1. No accounts in MetaMask
          // 2. Privy thinks we're authenticated
          // 3. User has been authenticated for at least 10 seconds (avoid chain switching issues)
          if (accounts.length === 0 && privyAuthenticated && state.user) {
            // Much longer delay to avoid race conditions during chain switching
            setTimeout(async () => {
              // Triple-check after delay
              try {
                if (window.ethereum) {
                  const recheckAccounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
                  if (recheckAccounts.length === 0 && privyAuthenticated && state.user) {
                    console.log('🔌 External wallet disconnected, logging out...');
                    await disconnectWallet();
                  }
                }
              } catch (error) {
                console.error('Error rechecking wallet connection:', error);
              }
            }, 10000); // 10 second delay - much more conservative
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
        }
      }
    };

    // Only check after user is fully authenticated and profile is loaded
    if (privyAuthenticated && state.user) {
      const timeoutId = setTimeout(checkWalletConnection, 5000); // Wait 5 seconds after auth

      // Listen for account changes with very conservative debouncing
      let accountChangeTimeout: NodeJS.Timeout;
      
      if (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.on === 'function') {
        const handleAccountsChanged = async (accounts: unknown) => {
          clearTimeout(accountChangeTimeout);
          
          accountChangeTimeout = setTimeout(async () => {
            const accountsArray = accounts as string[];
            // Only disconnect if user has been authenticated for a while AND no accounts
            if (accountsArray.length === 0 && privyAuthenticated && state.user) {
              console.log('🔌 Wallet accounts changed - disconnected');
              await disconnectWallet();
            }
          }, 10000); // 10 second debounce - very conservative
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        
        return () => {
          clearTimeout(timeoutId);
          clearTimeout(accountChangeTimeout);
          if (window.ethereum && typeof window.ethereum.removeListener === 'function') {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          }
        };
      }

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [privyAuthenticated, state.user]); // Monitor both auth and user state
  */

  // External wallet monitoring disabled - let Privy handle everything
  /*
  useEffect(() => {
    const checkWalletStatus = async () => {
      const hasExternal = await checkExternalWalletConnection();
      setState((prev) => ({
        ...prev,
        hasExternalWallet: hasExternal,
      }));

      console.log('🔍 External wallet status:', hasExternal ? 'Connected' : 'Not connected');
    };

    checkWalletStatus();
  }, [privyAuthenticated]);
  */

  // Initialize auth state when Privy is ready (external wallet optional)
  useEffect(() => {
    console.log('🔄 Auth state changed:', {
      privyAuthenticated,
      privyUser: !!privyUser,
    });

    if (privyAuthenticated && privyUser) {
      console.log('✅ Privy authenticated, calling initializeAuth...');
      initializeAuth();
    } else {
      console.log('❌ Not authenticated with Privy, clearing user...');
      setState((prev) => ({
        ...prev,
        user: null,
        isLoading: false,
      }));
    }
  }, [privyAuthenticated, privyUser]);

  const initializeAuth = async () => {
    try {
      console.log('🚀 Starting auth initialization...');
      console.log('📱 Privy authenticated:', privyAuthenticated);
      console.log('👤 Privy user:', privyUser);

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Create user profile from Privy data directly
      // Backend automatically creates users, so we don't need to call /me
      const userProfile: UserProfile = {
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

      console.log('✅ Setting user profile from Privy data:', userProfile);
      setState((prev) => ({
        ...prev,
        user: userProfile,
      }));
    } catch (error) {
      console.error('❌ Auth initialization error:', error);
      setState((prev) => ({
        ...prev,
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

      const walletAddress = privyUser?.wallet?.address;
      const result = await ProfileApi.getCurrentProfile(token, walletAddress);

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
      console.log('🔄 Connection already in progress, skipping...');
      return;
    }

    try {
      setConnectionAttempting(true);
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // If user is already authenticated with Privy, they're good to go
      if (privyAuthenticated && privyUser) {
        console.log('✅ User already authenticated with Privy');
        return;
      }

      // For new users, start with Privy login (which will show embedded wallet option first)
      console.log('🔑 Starting Privy login flow...');
      await privyLogin();
    } catch (error) {
      console.error('❌ Connect wallet error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
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

  // Debug authentication state
  // console.log('🔍 Auth Debug:', {
  //   privyAuthenticated,
  //   stateUser: !!state.user,
  //   isAuthenticated: privyAuthenticated && !!state.user,
  //   error: state.error,
  // });

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
