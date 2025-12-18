'use client';

import { useEffect, type ReactNode } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const { isMiniAppReady, setMiniAppReady } = useMiniKit();

  useEffect(() => {
    if (isMiniAppReady) {
      return;
    }

    let cancelled = false;

    async function signalReady() {
      try {
        await setMiniAppReady();
        if (!cancelled) {
          console.info('[MiniApp] Ready signal acknowledged');
        }
      } catch (error) {
        console.error('[MiniApp] Failed to signal ready()', error);
      }
    }

    void signalReady();

    return () => {
      cancelled = true;
    };
  }, [isMiniAppReady, setMiniAppReady]);

  return <>{children}</>;
}
