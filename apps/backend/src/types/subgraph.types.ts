/**
 * Subgraph OHLCV Types
 *
 * These types define the structure of pre-aggregated OHLCV data
 * fetched from the Goldsky subgraph.
 */

/**
 * Raw candle data from subgraph (values in WEI)
 */
export interface SubgraphCandle {
  date: number; // Unix timestamp in seconds
  id: string; // Format: {tokenAddress}-{periodId}
  tradesCount: number;
  tokensBought: string; // WEI (18 decimals)
  tokensSold: string; // WEI (18 decimals)
  open: string; // Price in WEI
  high: string; // Price in WEI
  low: string; // Price in WEI
  close: string; // Price in WEI
}

/**
 * Token data structure with all timeframe arrays
 */
export interface SubgraphTokenData {
  tokenFives: SubgraphCandle[]; // 5-minute candles
  tokenFifteens: SubgraphCandle[]; // 15-minute candles
  tokenHours: SubgraphCandle[]; // 1-hour candles
  tokenFourHours: SubgraphCandle[]; // 4-hour candles
  tokenDays: SubgraphCandle[]; // 1-day candles
}

/**
 * GraphQL response wrapper from subgraph
 */
export interface SubgraphResponse {
  data: {
    tokens: SubgraphTokenData[];
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

/**
 * Processed candle data (converted from WEI to decimal strings)
 */
export interface CandleData {
  timestamp: Date;
  open: string; // Decimal string (converted from WEI)
  high: string;
  low: string;
  close: string;
  volume: string; // Decimal string (tokensBought + tokensSold, converted from WEI)
  trades: number;
}

/**
 * All timeframes data structure
 */
export interface AllTimeframeData {
  '5m': CandleData[];
  '15m': CandleData[];
  '1h': CandleData[];
  '4h': CandleData[];
  '1d': CandleData[];
}

/**
 * Timeframe to subgraph field mapping
 */
export interface TimeframeMapping {
  [key: string]: string;
}

/**
 * Mapping of timeframe strings to their subgraph field names
 */
export const SUBGRAPH_TIMEFRAME_FIELDS: TimeframeMapping = {
  '5m': 'tokenFives',
  '15m': 'tokenFifteens',
  '1h': 'tokenHours',
  '4h': 'tokenFourHours',
  '1d': 'tokenDays',
};

/**
 * Timeframe intervals in milliseconds
 */
export const TIMEFRAME_INTERVALS_MS: { [key: string]: number } = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

/**
 * Supported timeframes
 */
export const SUPPORTED_TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d'] as const;
export type SupportedTimeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}
