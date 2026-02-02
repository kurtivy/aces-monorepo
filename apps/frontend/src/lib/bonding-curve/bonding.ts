/**
 * @deprecated Bonding curve functionality has been removed. All tokens now operate in DEX mode only.
 * This file is kept for backwards compatibility but should not be used for new code.
 * Use DEX quotes instead via DexApi from '@/lib/api/dex'.
 */
import type { ApiResponse } from '@aces/utils';

function getBondingApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3002';
  }

  if (typeof window !== 'undefined') {
    const href = window.location.href;
    if (href.includes('git-dev')) {
      return 'https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app';
    }
  }

  return 'https://acesbackend-production.up.railway.app';
}

const API_BASE_URL = getBondingApiBaseUrl();

export interface DirectQuoteResponse {
  inputAsset: 'ACES' | 'TOKEN';
  inputAmount: string;
  expectedOutput: string;
  inputUsdValue: string | null;
  outputUsdValue: string | null;
  path: string[];
  slippageBps: number;
}

export interface MultiHopQuoteResponse {
  inputAsset: 'ACES' | 'WETH' | 'USDC' | 'USDT';
  inputAmount: string;
  inputAmountRaw?: string;
  expectedAcesAmount: string;
  expectedAcesAmountRaw?: string;
  minAcesAmount?: string;
  minAcesAmountRaw?: string;
  expectedRwaOutput: string;
  path: string[];
  intermediate?: Array<{ symbol: string; amount: string }>;
  slippageBps: number;
  needsMultiHop: boolean;
  inputUsdValue?: string | null;
  outputUsdValue?: string | null;
}

export interface ApiSuccess<T> extends ApiResponse<T> {
  success: true;
}

export interface ApiFailure {
  success: false;
  error: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

async function request<T>(endpoint: string): Promise<ApiResult<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const errorPayload = await response.json();
        console.log('[BondingApi] Error response payload:', errorPayload);
        message = errorPayload.error || errorPayload.message || message;
      } catch (e) {
        console.log('[BondingApi] Failed to parse error response:', e);
      }

      return {
        success: false,
        error: message,
      };
    }

    const payload = await response.json();
    console.log('[BondingApi] Success response payload:', payload);
    return payload as ApiResult<T>;
  } catch (error) {
    console.error(`[BondingApi] request failed for ${endpoint}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export class BondingApi {
  /**
   * Get direct bonding curve quote for ACES ↔ TOKEN swaps
   * Used when user wants to swap directly between ACES and RWA token
   */
  static getDirectQuote(
    tokenAddress: string,
    {
      inputAsset,
      amount,
      slippageBps,
    }: {
      inputAsset: 'ACES' | 'TOKEN';
      amount: string;
      slippageBps?: number;
    },
  ) {
    const params = new URLSearchParams();
    params.set('inputAsset', inputAsset);
    params.set('amount', amount);
    if (typeof slippageBps === 'number') {
      params.set('slippageBps', String(slippageBps));
    }

    return request<DirectQuoteResponse>(
      `/api/v1/bonding/${tokenAddress}/quote?${params.toString()}`,
    );
  }

  /**
   * Get multi-hop quote for bonding curve purchases
   * Used when user wants to buy RWA with WETH/USDC/USDT
   */
  static getMultiHopQuote(
    tokenAddress: string,
    {
      inputAsset,
      amount,
      slippageBps,
    }: {
      inputAsset: 'ACES' | 'WETH' | 'USDC' | 'USDT';
      amount: string;
      slippageBps?: number;
    },
  ) {
    const params = new URLSearchParams();
    params.set('inputAsset', inputAsset);
    params.set('amount', amount);
    if (typeof slippageBps === 'number') {
      params.set('slippageBps', String(slippageBps));
    }

    return request<MultiHopQuoteResponse>(
      `/api/v1/bonding/${tokenAddress}/multi-hop-quote?${params.toString()}`,
    );
  }
}
