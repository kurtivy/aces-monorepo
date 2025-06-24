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
    (context: string = 'general'): NavigationSafetyResult => {
      const result = checkNavigationSafety(stateRef.current);

      // Only log when safety status changes to avoid console spam
      if (
        !lastSafetyCheckRef.current ||
        lastSafetyCheckRef.current.isNavigationSafe !== result.isNavigationSafe
      ) {
        if (!result.isNavigationSafe) {
          console.debug(
            `[Phase 2 Step 8] Navigation blocked (${context}): ${result.blockedReason}`,
          );
        } else if (lastSafetyCheckRef.current && !lastSafetyCheckRef.current.isNavigationSafe) {
          console.debug(`[Phase 2 Step 8] Navigation now safe (${context})`);
        }
      }

      lastSafetyCheckRef.current = result;
      return result;
    },
    [], // Empty dependency array since we use stateRef.current
  );

  // Safe navigation wrapper for click handlers
  const withNavigationSafety = useCallback(
    (
      navigationFn: () => void,
      context: string = 'navigation',
      forceAllow: boolean = false,
    ): (() => void) => {
      return () => {
        const safety = checkSafeNavigation(context);

        if (safety.canProceed || forceAllow) {
          try {
            navigationFn();
          } catch (error) {
            console.error(`[Phase 2 Step 8] Navigation error (${context}):`, error);
          }
        } else {
          console.warn(`[Phase 2 Step 8] Navigation blocked (${context}): ${safety.blockedReason}`);
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
