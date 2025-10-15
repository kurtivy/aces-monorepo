import { useMemo } from 'react';
import { usePriceContext } from '@/contexts/price-context';

interface UseAcesUsdPriceProps {
  enabled?: boolean;
}

/**
 * Refactored to use shared PriceContext
 * Now polls every 10 seconds (from shared context) instead of 5 minutes
 * Maintains backward compatibility with old interface
 */
export function useAcesUsdPrice({ enabled = true }: UseAcesUsdPriceProps = {}) {
  const { acesPrice, loading, error } = usePriceContext();

  return useMemo(() => {
    if (!enabled) {
      return {
        acesUsdPrice: null,
        loading: false,
        error: null,
      };
    }

    return {
      acesUsdPrice: acesPrice > 0 ? acesPrice.toString() : null,
      loading,
      error,
    };
  }, [enabled, acesPrice, loading, error]);
}
