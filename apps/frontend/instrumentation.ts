/**
 * 🔥 PHASE 5: Next.js Instrumentation Hook for Sentry
 * This file is automatically loaded by Next.js and initializes Sentry
 * on both client and server sides
 */

import * as Sentry from '@sentry/nextjs';

export async function register() {
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

