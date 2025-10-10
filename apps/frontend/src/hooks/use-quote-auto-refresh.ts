import { useEffect, useRef, useCallback, useMemo } from 'react';

interface UseQuoteAutoRefreshProps {
  enabled: boolean; // Only refresh when enabled
  intervalMs?: number; // Refresh interval (default 10s)
  onRefresh: () => void | Promise<void>; // Callback to refresh quote
}

interface UseQuoteAutoRefreshResult {
  manualRefresh: () => void;
  stopAutoRefresh: () => void;
}

/**
 * Hook for auto-refreshing quotes every N seconds
 *
 * Automatically refreshes quotes at a specified interval when enabled.
 * Provides manual refresh function that resets the timer.
 * Properly cleans up on unmount.
 *
 * @example
 * const { manualRefresh } = useQuoteAutoRefresh({
 *   enabled: hasValidAmount && !isDexMode,
 *   intervalMs: 10000, // 10 seconds
 *   onRefresh: refreshQuote,
 * });
 */
export function useQuoteAutoRefresh({
  enabled,
  intervalMs = 10000, // 10 seconds default
  onRefresh,
}: UseQuoteAutoRefreshProps): UseQuoteAutoRefreshResult {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(Date.now());

  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[useQuoteAutoRefresh] Stopped auto-refresh');
    }
  }, []);

  const startAutoRefresh = useCallback(() => {
    // Clear existing interval
    stopAutoRefresh();

    if (!enabled) {
      return;
    }

    console.log('[useQuoteAutoRefresh] Starting auto-refresh with interval:', intervalMs);

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshRef.current;

      console.log('[useQuoteAutoRefresh] Auto-refreshing quote...', {
        timeSinceLastRefresh: `${(timeSinceLastRefresh / 1000).toFixed(1)}s`,
      });

      onRefresh();
      lastRefreshRef.current = now;
    }, intervalMs);
  }, [enabled, intervalMs, onRefresh, stopAutoRefresh]);

  // Manual refresh that resets the timer
  const manualRefresh = useCallback(() => {
    lastRefreshRef.current = Date.now();
    onRefresh();

    // Restart the interval to reset the countdown
    if (enabled) {
      startAutoRefresh();
    }
  }, [onRefresh, enabled, startAutoRefresh]);

  // Start/stop based on enabled state
  useEffect(() => {
    if (enabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [enabled, startAutoRefresh, stopAutoRefresh]);

  return useMemo(
    () => ({
      manualRefresh,
      stopAutoRefresh,
    }),
    [manualRefresh, stopAutoRefresh],
  );
}
