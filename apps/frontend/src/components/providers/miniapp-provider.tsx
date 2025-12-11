'use client';

import { useEffect, type ReactNode } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export function MiniAppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Signal to the Base app that the mini app is ready to be displayed
    sdk.actions.ready();
  }, []);

  return <>{children}</>;
}
