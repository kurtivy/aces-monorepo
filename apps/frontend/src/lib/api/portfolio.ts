import type { ApiResponse } from '@aces/utils';

function getPortfolioApiBaseUrl(): string {
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

const API_BASE_URL = getPortfolioApiBaseUrl();

export interface TokenHolding {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  balance: string;
  currentPrice: string;
  entryPrice: string;
  totalInvested: string;
  currentValue: string;
  pnl: string;
  pnlPercentage: string;
  allocation: number;
  owner: {
    id: string;
    address: string;
  };
  tokenData: {
    supply: string;
    tradesCount: number;
    bonded: boolean;
    tokensBought: string;
    tokensSold: string;
  };
}

export interface PortfolioMetrics {
  totalValue: string;
  totalInvested: string;
  totalPnL: string;
  pnlPercentage: string;
  tokenCount: number;
  topPerformer: TokenHolding | null;
  worstPerformer: TokenHolding | null;
}

export interface PortfolioData {
  walletAddress: string;
  holdings: TokenHolding[];
  metrics: PortfolioMetrics;
  meta: {
    totalHoldings: number;
    returnedHoldings: number;
    hasMore: boolean;
    lastUpdate: number;
  };
}

export interface PortfolioSummary {
  walletAddress: string;
  metrics: PortfolioMetrics;
  topHoldings: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenName: string;
    currentValue: string;
    pnlPercentage: string;
    allocation: number;
  }>;
  lastUpdate: number;
}

/**
 * Fetch complete portfolio for a wallet address
 */
export async function fetchPortfolio(
  walletAddress: string,
  options: {
    includeMetrics?: boolean;
    limit?: number;
  } = {},
): Promise<ApiResponse<PortfolioData>> {
  try {
    const params = new URLSearchParams();
    if (options.includeMetrics !== undefined) {
      params.set('includeMetrics', options.includeMetrics.toString());
    }
    if (options.limit !== undefined) {
      params.set('limit', options.limit.toString());
    }

    const url = `${API_BASE_URL}/api/v1/portfolio/${walletAddress}${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Portfolio API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result as ApiResponse<PortfolioData>;
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch portfolio',
    };
  }
}

/**
 * Fetch portfolio summary (metrics + top holdings only)
 */
export async function fetchPortfolioSummary(
  walletAddress: string,
): Promise<ApiResponse<PortfolioSummary>> {
  try {
    const url = `${API_BASE_URL}/api/v1/portfolio/${walletAddress}/summary`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Portfolio summary API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result as ApiResponse<PortfolioSummary>;
  } catch (error) {
    console.error('Error fetching portfolio summary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch portfolio summary',
    };
  }
}

/**
 * Fetch specific token holding for a wallet
 */
export async function fetchTokenHolding(
  walletAddress: string,
  tokenAddress: string,
): Promise<
  ApiResponse<{
    walletAddress: string;
    tokenAddress: string;
    holding: TokenHolding;
    lastUpdate: number;
  }>
> {
  try {
    const url = `${API_BASE_URL}/api/v1/portfolio/${walletAddress}/token/${tokenAddress}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Token holding API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching token holding:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch token holding',
    };
  }
}

/**
 * Format currency values for display
 */
export function formatCurrency(value: string | number, decimals: number = 6): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.000000';

  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage values for display
 */
export function formatPercentage(value: string | number, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00%';

  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Get color class for P&L display
 */
export function getPnLColorClass(pnl: string | number): string {
  const num = typeof pnl === 'string' ? parseFloat(pnl) : pnl;
  if (isNaN(num) || num === 0) return 'text-gray-400';
  return num > 0 ? 'text-green-400' : 'text-red-400';
}
