/**
 * 🔥 PHASE 5: Next.js Instrumentation Hook for Sentry
 * This file is automatically loaded by Next.js and initializes Sentry
 * on both client and server sides
 */

import * as Sentry from '@sentry/nextjs';

// Fix ethers v5 invalid referrer - must run before any RPC call (patch-fetch-referrer runs at import)
import './src/lib/utils/patch-fetch-referrer';

export async function register() {
  // patch-fetch-referrer is imported above and runs at module load (server-side)

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Initialize client-side Sentry
    if (typeof window !== 'undefined') {
      const { initSentryClient } = await import('./instrumentation-client');
      initSentryClient();
    } else {
      // Initialize server-side Sentry
      const { initSentryServer } = await import('./sentry.server.config');
      initSentryServer();
    }
  }
}

// 🔥 PHASE 5: Handle errors from nested React Server Components
// This fixes the deprecation warning about missing onRequestError hook
export const onRequestError = Sentry.captureRequestError;
