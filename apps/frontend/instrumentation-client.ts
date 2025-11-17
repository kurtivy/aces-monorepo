import * as Sentry from '@sentry/nextjs';

/**
 * 🔥 PHASE 5: Sentry Client Configuration for Frontend WebSocket Monitoring
 * Captures client-side errors, performance metrics, and WebSocket health issues
 *
 * Note: This file is named `instrumentation-client.ts` per Next.js conventions
 * for Turbopack compatibility
 */

export function initSentryClient() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development',

    // Tracing - capture performance metrics
    tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Session Replay - record user sessions with errors
    replaysSessionSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.1',
    ),
    replaysOnErrorSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE || '1.0',
    ),

    // Integrations
    integrations: [
      // Session replay - masks sensitive data automatically
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      // User feedback form for error reporting
      Sentry.feedbackIntegration({
        colorScheme: 'system',
      }),
    ],

    // Only enable on client-side (window exists)
    enabled: typeof window !== 'undefined',

    // Attach stack traces to all messages
    attachStacktrace: true,

    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'chrome-extension://',
      'moz-extension://',
      // LocalStorage quota exceeded
      'QuotaExceededError',
      // Network errors we can't control
      'NetworkError',
      'timeout',
    ],
  });
}

// Router instrumentation for Next.js
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
