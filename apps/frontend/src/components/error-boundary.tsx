'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Error Boundary] Caught error:', error, errorInfo);

    // Firefox-specific error handling
    if (typeof window !== 'undefined' && navigator.userAgent.includes('Firefox')) {
      console.warn('[Firefox] Error caught in boundary:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
      });

      // Log additional Firefox-specific information
      console.warn('[Firefox] Document state:', {
        readyState: document.readyState,
        fontsReady: document.fonts ? 'available' : 'not available',
        imagesCount: document.querySelectorAll('img').length,
      });
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error?: Error; resetError: () => void }> = ({
  error,
  resetError,
}) => {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="text-center p-8 max-w-md">
        <div className="text-[#D0B264] text-2xl font-syne font-bold mb-4">Something went wrong</div>
        <div className="text-white/80 text-sm mb-6">
          {error?.message || 'An unexpected error occurred'}
        </div>
        <div className="space-y-3">
          <button
            onClick={resetError}
            className="w-full bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-syne font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full border border-[#D0B264]/40 text-[#D0B264] hover:bg-[#D0B264]/10 font-syne font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
