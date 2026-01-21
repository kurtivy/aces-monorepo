'use client';

import { sdk } from '@farcaster/miniapp-sdk';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { signalMiniAppReadyOnce } from '../lib/miniapp/ready';

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type MiniAppContext = {
  user: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  location?: {
    type: string;
    [key: string]: unknown;
  };
  client: {
    platformType?: 'web' | 'mobile';
    clientFid: number;
    added: boolean;
    safeAreaInsets?: SafeAreaInsets;
    notificationDetails?: {
      url: string;
      token: string;
    };
  };
  features?: {
    haptics: boolean;
    cameraAndMicrophoneAccess?: boolean;
  };
};

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export type MiniAppContextValue = {
  isInMiniApp: boolean;
  context: MiniAppContext | null;
  loadState: LoadState;
  error: string | null;
  safeAreaInsets: SafeAreaInsets | null;
};

const MiniAppContextState = createContext<MiniAppContextValue | null>(null);

export function MiniAppContextProvider({ children }: { children: ReactNode }) {
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setLoadState('loading');
      setError(null);
      console.log('[MiniAppContext] Starting context load...');

      try {
        const inMiniApp = await sdk.isInMiniApp();
        if (cancelled) return;
        setIsInMiniApp(inMiniApp);
        console.log('[MiniAppContext] isInMiniApp:', inMiniApp);

        if (inMiniApp) {
          const nextContext = (await sdk.context) as MiniAppContext;
          if (cancelled) return;
          setContext(nextContext);
          console.log('[MiniAppContext] Context loaded:', {
            user: nextContext.user,
            platform: nextContext.client.platformType,
            safeAreaInsets: nextContext.client.safeAreaInsets,
            location: nextContext.location?.type,
          });
        } else {
          setContext(null);
          console.log('[MiniAppContext] Not in mini app, context set to null');
        }

        if (!cancelled) {
          setLoadState('loaded');
        }
      } catch (error) {
        if (!cancelled) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load mini app context';
          setError(errorMessage);
          setLoadState('error');
          console.error('[MiniAppContext] Error loading context:', error);
        }
      } finally {
        await signalMiniAppReadyOnce(() => sdk.actions.ready(), 'sdk.actions.ready');
        console.log('[MiniAppContext] Ready signal sent');
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, []);

  const safeAreaInsets = context?.client?.safeAreaInsets ?? null;

  const value = useMemo(
    () => ({
      isInMiniApp,
      context,
      loadState,
      error,
      safeAreaInsets,
    }),
    [context, error, isInMiniApp, loadState, safeAreaInsets],
  );

  return <MiniAppContextState.Provider value={value}>{children}</MiniAppContextState.Provider>;
}

export function useMiniAppContext(): MiniAppContextValue {
  const context = useContext(MiniAppContextState);
  if (!context) {
    throw new Error('useMiniAppContext must be used within a MiniAppContextProvider');
  }
  return context;
}
