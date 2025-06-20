/**
 * CORS and Canvas-Specific Error Boundary
 *
 * Phase 2 Step 9: Add Comprehensive Error Boundaries and Fallbacks
 *
 * This component provides:
 * - CORS-specific error boundary for image loading failures
 * - Canvas operation error boundaries
 * - Browser compatibility error handling
 * - Graceful degradation with luxury-styled fallbacks
 * - Performance monitoring integration
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { LuxuryLogger } from '../lib/utils/luxury-logger';
import { getDeviceCapabilities, browserUtils } from '../lib/utils/browser-utils';

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorType?: 'cors' | 'canvas' | 'browser' | 'performance' | 'unknown';
  errorInfo?: ErrorInfo;
  canRecover: boolean;
  retryCount: number;
}

// Error classification for better user messaging
function classifyError(error: Error): {
  type: 'cors' | 'canvas' | 'browser' | 'performance' | 'unknown';
  canRecover: boolean;
  userMessage: string;
  technicalMessage: string;
} {
  const message = error.message.toLowerCase();

  // Issue 3M: CORS-specific error classification
  if (
    error.name === 'SecurityError' ||
    message.includes('cors') ||
    message.includes('cross-origin') ||
    message.includes('tainted') ||
    message.includes('todataurl')
  ) {
    return {
      type: 'cors',
      canRecover: false,
      userMessage:
        'Some images could not be loaded due to security restrictions. The application will continue with available content.',
      technicalMessage: 'CORS policy violation or tainted canvas detected',
    };
  }

  // Issue 2Y: Canvas context errors
  if (
    message.includes('getcontext') ||
    message.includes('canvas') ||
    message.includes('context') ||
    message.includes('webgl')
  ) {
    return {
      type: 'canvas',
      canRecover: true,
      userMessage:
        'Canvas rendering encountered an issue. Attempting recovery with fallback options.',
      technicalMessage: 'Canvas context creation or operation failed',
    };
  }

  // Browser compatibility issues
  if (
    message.includes('browser') ||
    message.includes('unsupported') ||
    message.includes('not supported') ||
    message.includes('compatibility')
  ) {
    return {
      type: 'browser',
      canRecover: true,
      userMessage: 'Your browser version may need updated features. Using compatibility mode.',
      technicalMessage: 'Browser feature compatibility issue detected',
    };
  }

  // Performance-related errors
  if (
    message.includes('memory') ||
    message.includes('performance') ||
    message.includes('timeout') ||
    message.includes('frame')
  ) {
    return {
      type: 'performance',
      canRecover: true,
      userMessage:
        'Performance optimization applied for your device. Quality may be reduced for smoother experience.',
      technicalMessage: 'Performance threshold exceeded, applying adaptive quality',
    };
  }

  return {
    type: 'unknown',
    canRecover: true,
    userMessage:
      'An unexpected issue occurred. The application is attempting to recover automatically.',
    technicalMessage: 'Unclassified error requiring manual investigation',
  };
}

export class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  private retryTimeout?: NodeJS.Timeout;
  private maxRetries = 3;

  constructor(props: CanvasErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      canRecover: true,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<CanvasErrorBoundaryState> {
    const classification = classifyError(error);

    return {
      hasError: true,
      error,
      errorType: classification.type,
      canRecover: classification.canRecover,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const classification = classifyError(error);
    const capabilities = getDeviceCapabilities();

    // Enhanced error logging for Phase 2 Step 9
    LuxuryLogger.log(
      `[Canvas Error Boundary] ${classification.type.toUpperCase()} Error in ${this.props.context || 'Canvas Component'}`,
      'error',
    );

    // Log comprehensive error context
    const errorContext = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      classification,
      context: this.props.context || 'unknown',
      componentStack: errorInfo.componentStack,
      browser: {
        name: browserUtils.isSafari() ? 'Safari' : browserUtils.isFirefox() ? 'Firefox' : 'Other',
        mobile: browserUtils.isMobile(),
        performanceTier: capabilities.performanceTier,
      },
      device: {
        availableMemory: capabilities.availableMemory,
        hardwareConcurrency: capabilities.hardwareConcurrency,
        devicePixelRatio: capabilities.devicePixelRatio,
      },
      retryCount: this.state.retryCount,
    };

    LuxuryLogger.log(`Error Context: ${JSON.stringify(errorContext, null, 2)}`, 'info');

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Automatic recovery attempt for recoverable errors
    if (classification.canRecover && this.state.retryCount < this.maxRetries) {
      this.scheduleRetry();
    }

    this.setState({ errorInfo });
  }

  private scheduleRetry = () => {
    // Progressive retry delays: 1s, 3s, 5s
    const delay = Math.min(1000 + this.state.retryCount * 2000, 5000);

    this.retryTimeout = setTimeout(() => {
      LuxuryLogger.log(
        `Attempting error recovery (attempt ${this.state.retryCount + 1}/${this.maxRetries})`,
        'info',
      );
      this.resetError();
    }, delay);
  };

  private resetError = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    this.setState((prevState) => ({
      hasError: false,
      error: undefined,
      errorType: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1,
    }));
  };

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default luxury-styled error UI
      const classification = classifyError(this.state.error);
      const capabilities = getDeviceCapabilities();

      return (
        <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-br from-gray-900 to-black rounded-lg border border-gray-700 p-8">
          <div className="text-center max-w-md">
            {/* Luxury error icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-yellow-600 to-yellow-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-yellow-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            {/* Error type indicator */}
            <div className="mb-4">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  classification.type === 'cors'
                    ? 'bg-red-900 text-red-200'
                    : classification.type === 'canvas'
                      ? 'bg-orange-900 text-orange-200'
                      : classification.type === 'browser'
                        ? 'bg-blue-900 text-blue-200'
                        : classification.type === 'performance'
                          ? 'bg-yellow-900 text-yellow-200'
                          : 'bg-gray-900 text-gray-200'
                }`}
              >
                {classification.type.toUpperCase()} ERROR
              </span>
            </div>

            {/* User-friendly message */}
            <h3 className="text-xl font-semibold text-white mb-4">
              {classification.type === 'cors'
                ? 'Content Loading Issue'
                : classification.type === 'canvas'
                  ? 'Display Rendering Issue'
                  : classification.type === 'browser'
                    ? 'Browser Compatibility Issue'
                    : classification.type === 'performance'
                      ? 'Performance Optimization'
                      : 'Technical Issue'}
            </h3>

            <p className="text-gray-300 mb-6 leading-relaxed">{classification.userMessage}</p>

            {/* Recovery actions */}
            <div className="space-y-3">
              {classification.canRecover && this.state.retryCount < this.maxRetries && (
                <button
                  onClick={this.resetError}
                  className="w-full px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105"
                >
                  Try Again ({this.maxRetries - this.state.retryCount} attempts left)
                </button>
              )}

              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-2 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white rounded-lg transition-colors duration-200"
              >
                Reload Page
              </button>
            </div>

            {/* Technical details for development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-6 text-left">
                <summary className="text-gray-400 text-sm cursor-pointer hover:text-gray-300">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-gray-800 rounded text-xs text-gray-300 font-mono overflow-auto">
                  <p>
                    <strong>Error:</strong> {this.state.error.message}
                  </p>
                  <p>
                    <strong>Type:</strong> {classification.type}
                  </p>
                  <p>
                    <strong>Context:</strong> {this.props.context || 'Unknown'}
                  </p>
                  <p>
                    <strong>Browser:</strong> {browserUtils.isMobile() ? 'Mobile' : 'Desktop'} -{' '}
                    {capabilities.performanceTier} tier
                  </p>
                  <p>
                    <strong>Retry Count:</strong> {this.state.retryCount}
                  </p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer">Stack Trace</summary>
                      <pre className="mt-1 text-xs overflow-auto">{this.state.error.stack}</pre>
                    </details>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withCanvasErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: string,
) {
  return function WrappedComponent(props: P) {
    return (
      <CanvasErrorBoundary context={context}>
        <Component {...props} />
      </CanvasErrorBoundary>
    );
  };
}

// Specialized error boundaries for specific use cases
export const CORSErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <CanvasErrorBoundary context="CORS Image Loading">{children}</CanvasErrorBoundary>
);

export const CanvasRenderErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <CanvasErrorBoundary context="Canvas Rendering">{children}</CanvasErrorBoundary>
);

export const PerformanceErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <CanvasErrorBoundary context="Performance Optimization">{children}</CanvasErrorBoundary>
);
