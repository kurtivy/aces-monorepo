import { z } from 'zod';

const BitQueryConfigSchema = z.object({
  apiKey: z.string().min(1, 'BITQUERY_API_KEY is required'),
  endpoint: z.string().url().default('https://streaming.bitquery.io/graphql'),
  pollIntervalMs: z.number().default(2500),
  cacheTtlMs: z.number().default(5000),
  requestTimeoutMs: z.number().default(10000),
  maxRetries: z.number().default(3),
  retryDelayMs: z.number().default(1000),
});

export type BitQueryConfig = z.infer<typeof BitQueryConfigSchema>;

export function getBitQueryConfig(): BitQueryConfig {
  const config = BitQueryConfigSchema.parse({
    apiKey: process.env.BITQUERY_API_KEY,
    endpoint: process.env.BITQUERY_ENDPOINT,
    pollIntervalMs: parseInt(process.env.BITQUERY_POLL_INTERVAL_MS || '2500'),
    cacheTtlMs: parseInt(process.env.BITQUERY_CACHE_TTL_MS || '5000'),
    requestTimeoutMs: parseInt(process.env.BITQUERY_REQUEST_TIMEOUT_MS || '10000'),
    maxRetries: parseInt(process.env.BITQUERY_MAX_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.BITQUERY_RETRY_DELAY_MS || '1000'),
  });

  return config;
}

// BitQuery GraphQL queries as constants
export const BITQUERY_QUERIES = {
  // Get recent swaps for a specific token (NEW: DEXTradeByTokens)
  // No date filtering - uses BitQuery's default timeframe (usually last 7-30 days)
  GET_TOKEN_TRADES: `
    query GetTokenTrades(
      $network: evm_network
      $tokenAddress: String!
      $limit: Int
    ) {
      EVM(network: $network) {
        DEXTradeByTokens(
          where: {
            Trade: {
              Currency: {
                SmartContract: { is: $tokenAddress }
              }
              Price: { gt: 0 }
            }
          }
          orderBy: { descending: Block_Time }
          limit: { count: $limit }
        ) {
          Block {
            Time
            Number
          }
          Transaction {
            Hash
            From
          }
          Trade {
            Amount
            Price
            Side {
              Type
              Amount
              AmountInUSD
              Currency {
                Symbol
                SmartContract
                Name
              }
            }
            Dex {
              ProtocolName
              ProtocolFamily
            }
          }
        }
      }
    }
  `,

  // Get token trades with date filtering (for historical data)
  GET_TOKEN_TRADES_WITH_DATES: `
    query GetTokenTradesWithDates(
      $network: evm_network
      $tokenAddress: String!
      $limit: Int
      $from: DateTime!
      $to: DateTime!
    ) {
      EVM(network: $network, dataset: archive) {
        DEXTradeByTokens(
          where: {
            Block: { Time: { since: $from, till: $to } }
            Trade: {
              Currency: {
                SmartContract: { is: $tokenAddress }
              }
              Price: { gt: 0 }
            }
          }
          orderBy: { descending: Block_Time }
          limit: { count: $limit }
        ) {
          Block {
            Time
            Number
          }
          Transaction {
            Hash
            From
          }
          Trade {
            Amount
            Price
            Side {
              Type
              Amount
              AmountInUSD
              Currency {
                Symbol
                SmartContract
                Name
              }
            }
            Dex {
              ProtocolName
              ProtocolFamily
            }
          }
        }
      }
    }
  `,

  // Get recent swaps for a token pair (LEGACY - kept for backwards compatibility)
  GET_RECENT_SWAPS: `
    query GetRecentSwaps(
      $network: evm_network
      $poolAddress: String!
      $since: DateTime
      $limit: Int
    ) {
      EVM(network: $network) {
        DEXTrades(
          where: {
            Trade: {
              Dex: {
                SmartContract: { is: $poolAddress }
              }
            }
            Block: {
              Time: { since: $since }
            }
          }
          orderBy: { descending: Block_Time }
          limit: { count: $limit }
        ) {
          Block {
            Time
            Number
          }
          Transaction {
            Hash
            From
          }
          Trade {
            Sender
            Buy {
              Amount
              Currency {
                Symbol
                SmartContract
                Decimals
              }
              Price
              PriceInUSD
            }
            Sell {
              Amount
              Currency {
                Symbol
                SmartContract
                Decimals
              }
              Price
              PriceInUSD
            }
            Dex {
              ProtocolName
              ProtocolFamily
            }
          }
        }
      }
    }
  `,

  // Get recent swaps for a token pair without since filter
  GET_RECENT_SWAPS_NO_SINCE: `
    query GetRecentSwapsNoSince(
      $network: evm_network
      $poolAddress: String!
      $limit: Int
    ) {
      EVM(network: $network) {
        DEXTrades(
          where: {
            Trade: {
              Dex: {
                SmartContract: { is: $poolAddress }
              }
            }
          }
          orderBy: { descending: Block_Time }
          limit: { count: $limit }
        ) {
          Block {
            Time
            Number
          }
          Transaction {
            Hash
            From
          }
          Trade {
            Sender
            Buy {
              Amount
              Currency {
                Symbol
                SmartContract
                Decimals
              }
              Price
              PriceInUSD
            }
            Sell {
              Amount
              Currency {
                Symbol
                SmartContract
                Decimals
              }
              Price
              PriceInUSD
            }
            Dex {
              ProtocolName
              ProtocolFamily
            }
          }
        }
      }
    }
  `,

  // Get OHLC data (aggregated candles) using DEXTradeByTokens
  GET_OHLC_CANDLES_ARCHIVE: `
    query GetOHLCCandlesArchive(
      $network: evm_network
      $poolAddress: String
      $tokenAddress: String!
      $counterToken: String
      $from: DateTime!
      $to: DateTime!
      $intervalCount: Int!
      $intervalUnit: OLAP_DateTimeIntervalUnits!
      $priceAsymmetry: Float!
    ) {
      EVM(dataset: archive, network: $network) {
        DEXTradeByTokens(
          where: {
            Block: { Time: { since: $from, till: $to } }
            Trade: {
              Dex: {
                SmartContract: { is: $poolAddress }
              }
              Currency: { SmartContract: { is: $tokenAddress } }
              Side: {
                Amount: { gt: "0" }
                Currency: { SmartContract: { is: $counterToken } }
              }
              PriceAsymmetry: { lt: $priceAsymmetry }
            }
          }
          orderBy: { ascendingByField: "Block_Time" }
        ) {
          Block {
            Time(interval: { in: $intervalUnit, count: $intervalCount })
          }
          Trade {
            open: PriceInUSD(minimum: Block_Number)
            close: PriceInUSD(maximum: Block_Number)
            high: PriceInUSD(maximum: Trade_PriceInUSD)
            low: PriceInUSD(minimum: Trade_PriceInUSD)
          }
          volume: sum(of: Trade_Side_Amount)
          volumeUsd: sum(of: Trade_Side_AmountInUSD)
          tradesCount: count
        }
      }
    }
  `,

  GET_OHLC_CANDLES_COMBINED: `
    query GetOHLCCandlesCombined(
      $network: evm_network
      $poolAddress: String
      $tokenAddress: String!
      $counterToken: String
      $from: DateTime!
      $to: DateTime!
      $intervalCount: Int!
      $intervalUnit: OLAP_DateTimeIntervalUnits!
      $priceAsymmetry: Float!
    ) {
      EVM(dataset: combined, network: $network) {
        DEXTradeByTokens(
          where: {
            Block: { Time: { since: $from, till: $to } }
            Trade: {
              Dex: {
                SmartContract: { is: $poolAddress }
              }
              Currency: { SmartContract: { is: $tokenAddress } }
              Side: {
                Amount: { gt: "0" }
                Currency: { SmartContract: { is: $counterToken } }
              }
              PriceAsymmetry: { lt: $priceAsymmetry }
            }
          }
          orderBy: { ascendingByField: "Block_Time" }
        ) {
          Block {
            Time(interval: { in: $intervalUnit, count: $intervalCount })
          }
          Trade {
            open: PriceInUSD(minimum: Block_Number)
            close: PriceInUSD(maximum: Block_Number)
            high: PriceInUSD(maximum: Trade_PriceInUSD)
            low: PriceInUSD(minimum: Trade_PriceInUSD)
          }
          volume: sum(of: Trade_Side_Amount)
          volumeUsd: sum(of: Trade_Side_AmountInUSD)
          tradesCount: count
        }
      }
    }
  `,

  GET_OHLC_CANDLES_TOKEN_ONLY_COMBINED: `
    query GetOHLCCandlesTokenOnlyCombined(
      $network: evm_network
      $tokenAddress: String!
      $from: DateTime!
      $to: DateTime!
      $intervalCount: Int!
      $intervalUnit: OLAP_DateTimeIntervalUnits!
      $priceAsymmetry: Float!
    ) {
      EVM(dataset: combined, network: $network) {
        DEXTradeByTokens(
          where: {
            Block: { Time: { since: $from, till: $to } }
            Trade: {
              Currency: { SmartContract: { is: $tokenAddress } }
              PriceAsymmetry: { lt: $priceAsymmetry }
              Price: { gt: 0 }
            }
          }
          orderBy: { ascendingByField: "Block_Time" }
        ) {
          Block {
            Time(interval: { in: $intervalUnit, count: $intervalCount })
          }
          Trade {
            open: PriceInUSD(minimum: Block_Number)
            close: PriceInUSD(maximum: Block_Number)
            high: PriceInUSD(maximum: Trade_PriceInUSD)
            low: PriceInUSD(minimum: Trade_PriceInUSD)
          }
          volume: sum(of: Trade_Side_Amount)
          volumeUsd: sum(of: Trade_Side_AmountInUSD)
          tradesCount: count
        }
      }
    }
  `,

  // Get current pool state
  GET_POOL_STATE: `
    query GetPoolState(
      $network: evm_network
      $poolAddress: String!
    ) {
      EVM(network: $network) {
        BalanceUpdates(
          where: {
            BalanceUpdate: {
              Address: { is: $poolAddress }
            }
          }
          orderBy: { descending: Block_Number }
          limit: { count: 2 }
        ) {
          Currency {
            Symbol
            SmartContract
            Decimals
          }
          BalanceUpdate {
            Amount
          }
          Block {
            Time
            Number
          }
        }
      }
    }
  `,
  // Get latest price for market cap calculation
  GET_LATEST_PRICE_USD: `
    query GetLatestPriceUSD($tokenAddress: String!) {
      Trading {
        Tokens(
          where: {
            Token: { Address: { is: $tokenAddress } }
          }
          orderBy: { descending: Block_Time }
          limit: { count: 1 }
        ) {
          Block { Time }
          Price { Ohlc { Close } }
        }
      }
    }
  `,
};

export const BASE_NETWORK = 'base'; // BitQuery network identifier for Base
export const ACES_TOKEN_ADDRESS = '0x55337650856299363c496065C836B9C6E9dE0367'; // ACES token on Base
export const WETH_TOKEN_ADDRESS = '0x4200000000000000000000000000000000000006'; // Canonical WETH on Base
export const USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC

const acesWethPoolEnv =
  process.env.AERODROME_ACES_WETH_POOL || process.env.BITQUERY_ACES_WETH_POOL || '';
const wethUsdcPoolEnv = process.env.WETH_USDC_POOL || process.env.BITQUERY_WETH_USDC_POOL || '';

export const AERODROME_ACES_WETH_POOL = acesWethPoolEnv ? acesWethPoolEnv.toLowerCase() : '';
export const WETH_USDC_POOL = wethUsdcPoolEnv ? wethUsdcPoolEnv.toLowerCase() : '';

/**
 * Data source switching configuration for smart routing
 * Determines when to use individual trades vs pre-aggregated OHLCV
 */
export const DATA_SOURCE_CONFIG = {
  // Use pre-aggregated OHLCV for requests older than this many days
  HISTORICAL_BOUNDARY_DAYS: 5,

  // Cache time-to-live by data source type
  CACHE_TTL: {
    HISTORICAL_OHLC: 3600000, // 1 hour (historical data never changes)
    RECENT_TRADES: 1000, // 1 second (real-time updates)
    BONDING_TRADES: 1000, // 1 second (real-time updates)
  },
};

export const BITQUERY_OHLC_SETTINGS = {
  PRIMARY_DATASET: 'archive' as const,
  FALLBACK_DATASET: 'combined' as const,
  DEFAULT_MAX_PRICE_ASYMMETRY: 0.5,
  FALLBACK_MAX_PRICE_ASYMMETRY: 1.0,
};
