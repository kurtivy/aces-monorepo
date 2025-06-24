'use client';

import { useCallback, useRef } from 'react';

// Phase 2 Step 8 Action 1: Loading State Coordination for Navigation
// Lightweight navigation guard system that prevents navigation during critical loading phases

interface NavigationSafetyState {
  loadingState: 'loading' | 'ready';
  imagesLoaded: boolean;
  canvasReady: boolean;
}

interface NavigationSafetyResult {
  isNavigationSafe: boolean;
  blockedReason?: string;
  canProceed: boolean;
}

// Performance-first: Simple boolean checks without complex logic
const checkNavigationSafety = (state: NavigationSafetyState): NavigationSafetyResult => {
  // Critical loading phase - block all navigation
  if (state.loadingState === 'loading') {
    return {
      isNavigationSafe: false,
      blockedReason: 'Images still loading',
      canProceed: false,
    };
  }

  // Ready state - check canvas readiness for canvas-dependent navigation
  if (state.loadingState === 'ready') {
    if (!state.imagesLoaded || !state.canvasReady) {
      return {
        isNavigationSafe: false,
        blockedReason: 'Canvas not fully initialized',
        canProceed: false,
      };
    }

    return {
      isNavigationSafe: true,
      canProceed: true,
    };
  }

  // Default safe
  return {
    isNavigationSafe: true,
    canProceed: true,
  };
};

export const useNavigationSafety = (state: NavigationSafetyState) => {
  // Performance optimization: Use ref to avoid recreation
  const lastSafetyCheckRef = useRef<NavigationSafetyResult | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Lightweight navigation guard - minimal performance impact
  const checkSafeNavigation = useCallback(
    (): NavigationSafetyResult => {
      const result = checkNavigationSafety(stateRef.current);
      lastSafetyCheckRef.current = result;
      return result;
    },
    [], // Empty dependency array since we use stateRef.current
  );

  // Safe navigation wrapper for click handlers
  const withNavigationSafety = useCallback(
    (navigationFn: () => void, forceAllow: boolean = false): (() => void) => {
      return () => {
        const safety = checkSafeNavigation();

        if (safety.canProceed || forceAllow) {
          try {
            navigationFn();
          } catch (error) {}
        }
      };
    },
    [checkSafeNavigation],
  );

  // Current safety status
  const currentSafety = checkNavigationSafety(state);

  return {
    isNavigationSafe: currentSafety.isNavigationSafe,
    canProceed: currentSafety.canProceed,
    blockedReason: currentSafety.blockedReason,
    checkSafeNavigation,
    withNavigationSafety,
  };
};
