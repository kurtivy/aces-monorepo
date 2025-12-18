'use client';

import { useEffect, type ReactNode } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export function MiniAppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    async function signalReady() {
      try {
        await sdk.actions.ready();
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
  }, []);

  return <>{children}</>;
}
