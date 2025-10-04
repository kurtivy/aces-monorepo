import type { ApiResponse } from '@aces/utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates')
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

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
  intermediate?: Array<{ symbol: string; amount: string }>;
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
        message = errorPayload.error || errorPayload.message || message;
      } catch {
        // ignore json parse errors
      }

      return {
        success: false,
        error: message,
      };
    }

    const payload = await response.json();
    return payload as ApiResult<T>;
  } catch (error) {
    console.error(`[DexApi] request failed for ${endpoint}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export class DexApi {
  static getPool(tokenAddress: string) {
    return request<DexPoolResponse>(`/api/v1/dex/${tokenAddress}/pool`);
  }

  static getCandles(tokenAddress: string, resolution: string, lookbackMinutes?: number) {
    const params = new URLSearchParams({ resolution });
    if (lookbackMinutes) {
      params.set('lookbackMinutes', String(lookbackMinutes));
    }

    return request<DexCandleResponse>(
      `/api/v1/dex/${tokenAddress}/candles?${params.toString()}`,
    );
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
