import type { ApiResponse } from '@aces/utils';

function getDexApiBaseUrl(): string {
  // Use relative paths for Next.js API routes
  if (typeof window !== 'undefined') {
    return ''; // Relative path - Next.js will handle routing
  }
  // Server-side: use absolute URL if needed, otherwise relative
  return process.env.NEXT_PUBLIC_API_URL || '';
}

const API_BASE_URL = getDexApiBaseUrl();

export interface DexPoolResponse {
  poolAddress: string;
  tokenAddress: string;
  counterToken: string;
  reserves: {
    token: string;
    counter: string;
  };
  priceInCounter: number;
  lastUpdated: number;
  reserveRaw: {
    token: string;
    counter: string;
  };
  totalSupply?: string;
}

export interface DexCandleResponse {
  candles: Array<{
    startTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volumeToken: number;
    volumeCounter: number;
    resolution: string;
  }>;
}

export interface DexTradeResponse {
  txHash: string;
  timestamp: number;
  blockNumber: number;
  direction: 'buy' | 'sell';
  amountToken: string;
  amountCounter: string;
  priceInCounter: number;
  priceInUsd?: number;
  totalUsd?: number;
  trader?: string;
}

export interface DexQuoteResponse {
  inputAsset: string;
  inputAmount: string;
  inputAmountRaw: string;
  expectedOutput: string;
  expectedOutputRaw: string;
  minOutput: string;
  minOutputRaw: string;
  slippageBps: number;
  path: string[];
  routes: Array<{ from: string; to: string; stable: boolean }>;
  intermediate?: Array<{ symbol: string; amount: string }>;
  inputUsdValue?: string;
  outputUsdValue?: string;
  prices?: {
    aces?: number;
    weth?: number;
    usdc?: number;
    usdt?: number;
  };
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
  // Use simplified Next.js API route (no /v1)
  const normalizedEndpoint = endpoint.replace('/api/v1/', '/api/');
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

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
        message = errorPayload.error || errorPayload.message || message;
      } catch {
        // ignore json parse errors
      }

      // 🔥 FIX: Don't log 404 errors as errors - they're expected for resources that don't exist yet
      // (e.g., pools that haven't been created, tokens without DEX pools)
      if (response.status === 404) {
        // Silently return 404 - this is expected behavior for tokens without pools
        return {
          success: false,
          error: message,
        };
      }

      // Log other errors (5xx, etc.) but not 404s
      console.error(`[DexApi] Request failed for ${endpoint}:`, {
        status: response.status,
        message,
      });

      return {
        success: false,
        error: message,
      };
    }

    const payload = await response.json();
    return payload as ApiResult<T>;
  } catch (error) {
    console.error(`[DexApi] Network error for ${endpoint}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export class DexApi {
  /**
   * Get DEX pool state. Pass poolAddress when available - token address alone
   * often 404s for Slipstream/V3 pools that aren't resolvable via factory.
   */
  static getPool(tokenAddress: string, options?: { poolAddress?: string }) {
    const params = new URLSearchParams();
    if (options?.poolAddress) {
      params.set('poolAddress', options.poolAddress);
    }
    const query = params.toString();
    return request<DexPoolResponse>(`/api/v1/dex/${tokenAddress}/pool${query ? `?${query}` : ''}`);
  }

  static getCandles(tokenAddress: string, resolution: string, lookbackMinutes?: number) {
    const params = new URLSearchParams({ resolution });
    if (lookbackMinutes) {
      params.set('lookbackMinutes', String(lookbackMinutes));
    }

    return request<DexCandleResponse>(`/api/v1/dex/${tokenAddress}/candles?${params.toString()}`);
  }

  static getTrades(tokenAddress: string, limit = 50) {
    return request<DexTradeResponse[]>(`/api/v1/dex/${tokenAddress}/trades?limit=${limit}`);
  }

  static getQuote(
    tokenAddress: string,
    {
      inputAsset,
      amount,
      slippageBps,
    }: { inputAsset?: string; amount: string; slippageBps?: number },
  ) {
    const params = new URLSearchParams();
    if (inputAsset) params.set('inputAsset', inputAsset);
    if (amount) params.set('amount', amount);
    if (typeof slippageBps === 'number') params.set('slippageBps', String(slippageBps));

    return request<DexQuoteResponse>(`/api/v1/dex/${tokenAddress}/quote?${params.toString()}`);
  }
}
