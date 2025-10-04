'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

const resolveApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
};

const API_BASE_URL = resolveApiBaseUrl();

interface HolderCountState {
  holderCount: number | null;
  loading: boolean;
  error: string | null;
}

export function useTokenHolderCount(
  tokenAddress?: string,
  chainId?: number,
  initialHolderCount?: number | null,
) {
  const [state, setState] = useState<HolderCountState>(() => ({
    holderCount: initialHolderCount ?? null,
    loading: initialHolderCount == null,
    error: null,
  }));

  useEffect(() => {
    if (!tokenAddress) {
      setState({ holderCount: null, loading: false, error: null });
      return;
    }

    if (!ethers.utils.isAddress(tokenAddress)) {
      setState({ holderCount: null, loading: false, error: 'Invalid token address' });
      return;
    }

    let cancelled = false;

    const fetchHolderCount = async () => {
      const hasInitialValue = initialHolderCount != null;

      if (hasInitialValue) {
        setState({ holderCount: initialHolderCount ?? null, loading: false, error: null });
        return;
      }

      setState({ holderCount: null, loading: true, error: null });

      const searchParams = new URLSearchParams();
      if (chainId) {
        searchParams.set('chainId', String(chainId));
      }

      const endpointBase = `${API_BASE_URL}/api/v1/tokens/${encodeURIComponent(
        tokenAddress,
      )}/holders`;
      const endpoint = searchParams.size > 0 ? `${endpointBase}?${searchParams.toString()}` : endpointBase;

      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`Failed to fetch holder count: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data?.holderCount !== undefined) {
          if (!cancelled) {
            setState({ holderCount: result.data.holderCount, loading: false, error: null });
          }
          return;
        }

        throw new Error(result.error || 'Unable to fetch holder count');
      } catch (error) {
        console.error('Failed to fetch holder count from API:', error);
        if (!cancelled) {
          setState({
            holderCount: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch holder count',
          });
        }
      }
    };

    fetchHolderCount();

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, chainId, initialHolderCount]);

  return state;
}
