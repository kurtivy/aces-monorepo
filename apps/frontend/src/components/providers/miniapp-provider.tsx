'use client';

import { useEffect, type ReactNode } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { signalMiniAppReadyOnce } from '../../lib/miniapp/ready';

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const { context, isMiniAppReady, setMiniAppReady } = useMiniKit();

  useEffect(() => {
    if (isMiniAppReady) {
      return;
    }

    let cancelled = false;
    const fallbackDelayMs = 1500;

    async function signalReady() {
      try {
        await signalMiniAppReadyOnce(() => setMiniAppReady(), 'minikit.setMiniAppReady');
        if (!cancelled) {
          console.info('[MiniApp] Ready signal acknowledged');
        }
      } catch (error) {
        console.error('[MiniApp] Failed to signal ready()', error);
      }
    }

    if (context) {
      void signalReady();
      return () => {
        cancelled = true;
      };
    }

    const fallbackTimer = window.setTimeout(() => {
      console.warn('[MiniApp] Context missing; sending ready() fallback.');
      void signalReady();
    }, fallbackDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [context, isMiniAppReady, setMiniAppReady]);

  return <>{children}</>;
}
