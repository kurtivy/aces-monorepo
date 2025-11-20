/**
 * 🔥 PHASE 5: Sentry Backend Configuration for Fastify
 * Captures server-side errors, WebSocket issues, and API route failures
 */

import * as Sentry from '@sentry/node';

export function initSentryBackend() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',

    // Tracing - capture performance metrics for API routes
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Attach stack traces to all messages
    attachStacktrace: true,

    // Ignore certain errors
    ignoreErrors: ['AbortError', 'NetworkError', 'timeout', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'],

    // Note: captureUnhandledRejections and captureUncaughtExceptions are enabled by default
    // in @sentry/node, so we don't need to explicitly set them
  });
}
