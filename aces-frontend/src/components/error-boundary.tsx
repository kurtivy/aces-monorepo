import { Component, type ReactNode } from "react";

/**
 * ErrorBoundary — React class component that catches JavaScript errors
 * in its child component tree and renders a fallback UI instead of crashing
 * the entire page. Used to isolate failures in chart, swap, and other
 * independently-renderable sections.
 */

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Defaults to a generic "something went wrong" message. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  /** Called during render when a descendant throws — sets error state. */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[200px] items-center justify-center text-stone-400">
            <p>Something went wrong. Please refresh.</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
