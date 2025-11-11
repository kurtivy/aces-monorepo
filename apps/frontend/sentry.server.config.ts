import * as Sentry from '@sentry/nextjs';

/**
 * 🔥 PHASE 5: Sentry Server Configuration for Backend Errors
 * Captures server-side errors and API route issues
 */

export function initSentryServer() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development',

    // Tracing - capture performance metrics for API routes
    tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Attach stack traces to all messages
    attachStacktrace: true,

    // Ignore certain errors
    ignoreErrors: [
      'AbortError',
      'NetworkError',
      'timeout',
    ],
  });
}

