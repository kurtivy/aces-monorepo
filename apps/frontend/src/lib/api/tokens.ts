import type { ApiResponse } from '@aces/utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('feat-ui-updates')
    ? 'https://aces-monorepo-backend-git-feat-ui-updates-dan-aces-fun.vercel.app'
    : 'http://localhost:3002');

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

export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  success: true;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResult<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export class TokensApi {
  private static async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResult<T>> {
    const url = `${API_BASE_URL}${endpoint}`;

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  static async getTokenData(tokenAddress: string): Promise<ApiResult<TokenData>> {
    return this.request<TokenData>(`/api/v1/tokens/${tokenAddress}`);
  }

  static async refreshTokenData(tokenAddress: string): Promise<ApiResult<TokenData>> {
    return this.request<TokenData>(`/api/v1/tokens/${tokenAddress}/refresh`, {
      method: 'POST',
    });
  }

  static async getChartData(
    tokenAddress: string,
    timeframe: string,
  ): Promise<ApiResult<ChartData>> {
    return this.request<ChartData>(`/api/v1/tokens/${tokenAddress}/ohlcv?timeframe=${timeframe}`);
  }

  static async getTrades(tokenAddress: string, limit = 50): Promise<ApiResult<TradeData[]>> {
    return this.request<TradeData[]>(`/api/v1/tokens/${tokenAddress}/trades?limit=${limit}`);
  }
}
