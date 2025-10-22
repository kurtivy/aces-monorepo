import type { ApiResponse } from '@aces/utils';

function getBaseUrl(): string {
  // Use environment variable if available
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // For localhost development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3002';
  }

  // Dynamic URL based on current deployment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const href = window.location.href;

    // Check for dev/git-dev branch
    if (href.includes('git-dev') || hostname.includes('git-dev')) {
      return 'https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app';
    }
  }

  // Production fallback (main branch and aces.fun)
  return 'https://acesbackend-production.up.railway.app';
}

const API_BASE_URL = getBaseUrl();

export interface TokenData {
  contractAddress: string;
  symbol: string;
  name: string;
  currentPriceACES: string;
  volume24h: string;
  updatedAt: string;
  phase: string;
}

export interface ChartData {
  timeframe: string;
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  volume: Array<{
    time: number;
    value: number;
    color: string;
  }>;
  count: number;
}

export interface TradeData {
  id: string;
  isBuy: boolean;
  trader: { id: string };
  tokenAmount: string;
  acesTokenAmount: string;
  createdAt: string;
  blockNumber: string;
}

export interface TokenMetrics {
  contractAddress: string;
  volume24hUsd: number;
  volume24hAces: string;
  marketCapUsd: number;
  tokenPriceUsd: number;
  holderCount: number;
  totalFeesUsd: number;
  totalFeesAces: string;
  liquidityUsd: number | null;
  liquiditySource: 'bonding_curve' | 'dex' | null;
}

export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse extends ApiResponse<never> {
  success: false;
  error: string;
}

export type ApiResult<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class TokensApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResult<T>> {
    const basePath = '/api/v1/tokens';
    const url = `${API_BASE_URL}${basePath}${endpoint}`;

    const finalHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: finalHeaders,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || `Request failed with status ${response.status}`,
        };
      }

      return data as ApiSuccessResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  static async getTokenMetrics(tokenAddress: string): Promise<ApiResult<TokenMetrics>> {
    return this.request(`/${tokenAddress}/metrics`, {
      method: 'GET',
    });
  }

  static async getTokenData(tokenAddress: string): Promise<ApiResult<TokenData>> {
    return this.request<TokenData>(`/${tokenAddress}`, {
      method: 'GET',
    });
  }

  static async refreshTokenData(tokenAddress: string): Promise<ApiResult<TokenData>> {
    return this.request<TokenData>(`/${tokenAddress}/refresh`, {
      method: 'POST',
    });
  }

  static async getChartData(
    tokenAddress: string,
    timeframe: string,
  ): Promise<ApiResult<ChartData>> {
    return this.request<ChartData>(`/${tokenAddress}/ohlcv?timeframe=${timeframe}`, {
      method: 'GET',
    });
  }

  static async getTrades(tokenAddress: string, limit = 50): Promise<ApiResult<TradeData[]>> {
    return this.request<TradeData[]>(`/${tokenAddress}/trades?limit=${limit}`, {
      method: 'GET',
    });
  }
}
