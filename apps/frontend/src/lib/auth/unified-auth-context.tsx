'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { MiniAppAuthProvider, useMiniAppAuth } from './miniapp-auth-context';
import { AuthProvider, useAuth as useWebAuth } from './auth-context';
import { UserProfile } from '@/lib/api/profile';

// Unified auth interface that both providers must satisfy
interface UnifiedAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  walletAddress: string | null;
  error: string | null;
  authReady: boolean;
  isMiniApp: boolean;

  // Common methods
  signIn?: () => Promise<void>;
  connectWallet?: () => Promise<void>;
  disconnectWallet?: () => void;
  signOut?: () => void;
  refreshUserProfile: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;

  // Web-only methods (optional)
  updateProfile?: (data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  applyForSeller?: (formData: any) => Promise<boolean>;
  getVerificationStatus?: () => Promise<any>;
  hasRole?: (role: string | string[]) => boolean;
  isOwnerOf?: (resourceOwnerId: string) => boolean;
  requiresExternalWallet?: () => { required: boolean; message?: string };
  isVerifiedSeller?: boolean;
  isAdmin?: boolean;
  hasExternalWallet?: boolean;
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType | null>(null);

// Hook to use the unified auth (works in both environments)
export const useUnifiedAuth = (): UnifiedAuthContextType => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useUnifiedAuth must be used within UnifiedAuthProvider');
  }
  return context;
};

// Internal adapter component that bridges MiniApp auth to unified interface
function MiniAppAuthAdapter({ children }: { children: ReactNode }) {
  const miniAppAuth = useMiniAppAuth();

  const unifiedContext: UnifiedAuthContextType = {
    isAuthenticated: miniAppAuth.isAuthenticated,
    isLoading: miniAppAuth.isLoading,
    user: miniAppAuth.user,
    walletAddress: miniAppAuth.walletAddress,
    error: miniAppAuth.error,
    authReady: miniAppAuth.authReady,
    isMiniApp: true,
    signIn: miniAppAuth.signIn,
    signOut: miniAppAuth.signOut,
    refreshUserProfile: miniAppAuth.refreshUserProfile,
    getAccessToken: miniAppAuth.getAccessToken,
  };

  return <UnifiedAuthContext.Provider value={unifiedContext}>{children}</UnifiedAuthContext.Provider>;
}

// Internal adapter component that bridges Web auth to unified interface
function WebAuthAdapter({ children }: { children: ReactNode }) {
  const webAuth = useWebAuth();

  const unifiedContext: UnifiedAuthContextType = {
    isAuthenticated: webAuth.isAuthenticated,
    isLoading: webAuth.isLoading,
    user: webAuth.user,
    walletAddress: webAuth.walletAddress,
    error: webAuth.error,
    authReady: webAuth.authReady,
    isMiniApp: false,
    connectWallet: webAuth.connectWallet,
    disconnectWallet: webAuth.disconnectWallet,
    refreshUserProfile: webAuth.refreshUserProfile,
    getAccessToken: webAuth.getAccessToken,
    updateProfile: webAuth.updateProfile,
    applyForSeller: webAuth.applyForSeller,
    getVerificationStatus: webAuth.getVerificationStatus,
    hasRole: webAuth.hasRole,
    isOwnerOf: webAuth.isOwnerOf,
    requiresExternalWallet: webAuth.requiresExternalWallet,
    isVerifiedSeller: webAuth.isVerifiedSeller,
    isAdmin: webAuth.isAdmin,
    hasExternalWallet: webAuth.hasExternalWallet,
  };

  return <UnifiedAuthContext.Provider value={unifiedContext}>{children}</UnifiedAuthContext.Provider>;
}

// Main provider that detects environment and renders appropriate auth provider
export function UnifiedAuthProvider({ children }: { children: ReactNode }) {
  const { context } = useMiniKit();
  const isMiniApp = !!context;

  console.log('[UnifiedAuth] Environment detected:', isMiniApp ? 'Base Mini App' : 'Standalone Web');

  if (isMiniApp) {
    return (
      <MiniAppAuthProvider>
        <MiniAppAuthAdapter>{children}</MiniAppAuthAdapter>
      </MiniAppAuthProvider>
    );
  }

  return (
    <AuthProvider>
      <WebAuthAdapter>{children}</WebAuthAdapter>
    </AuthProvider>
  );
}
