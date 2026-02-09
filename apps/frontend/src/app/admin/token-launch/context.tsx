'use client';

import React, { createContext, useContext } from 'react';
import { useTokenLaunchState } from './hooks/use-token-launch-state';

type TokenLaunchState = ReturnType<typeof useTokenLaunchState>;

const TokenLaunchContext = createContext<TokenLaunchState | null>(null);

export function TokenLaunchProvider({ children }: { children: React.ReactNode }) {
  const value = useTokenLaunchState();
  return <TokenLaunchContext.Provider value={value}>{children}</TokenLaunchContext.Provider>;
}

export function useTokenLaunch(): TokenLaunchState {
  const ctx = useContext(TokenLaunchContext);
  if (ctx === null) {
    throw new Error('useTokenLaunch must be used within TokenLaunchProvider');
  }
  return ctx;
}
