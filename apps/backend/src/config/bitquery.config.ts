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
  // Get recent swaps for a token pair
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
  GET_OHLC_CANDLES: `
    query GetOHLCCandles(
      $network: evm_network
      $poolAddress: String!
      $tokenAddress: String!
      $counterToken: String!
      $from: DateTime!
      $to: DateTime!
      $intervalCount: Int!
    ) {
      EVM(dataset: archive, network: $network) {
        DEXTradeByTokens(
          where: {
            Block: { Time: { since: $from, till: $to } }
            Trade: {
              Dex: { SmartContract: { is: $poolAddress } }
              Currency: { SmartContract: { is: $tokenAddress } }
              Side: { Currency: { SmartContract: { is: $counterToken } } }
            }
          }
          orderBy: { ascendingByField: "Block_Time" }
        ) {
          Block {
            Time(interval: { in: minutes, count: $intervalCount })
          }
          Trade {
            open: Price(minimum: Block_Time)
            close: Price(maximum: Block_Time)
            high: Price(maximum: Trade_Price)
            low: Price(minimum: Trade_Price)
            PriceInUSD
          }
          tradesCount: count
          baseVolume: sum(of: Trade_Amount)
          quoteVolume: sum(of: Trade_Side_Amount)
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

  // Get OHLC data using Trading.Tokens query (accurate USD pricing)
  GET_TRADING_TOKENS_OHLC: `
    query GetTradingTokensOHLC(
      $tokenAddress: String!
      $from: DateTime!
      $to: DateTime!
      $intervalSeconds: Int!
    ) {
      Trading {
        Tokens(
          where: {
            Volume: { Usd: { gt: 0 } }
            Token: { Address: { is: $tokenAddress } }
            Interval: { Time: { Duration: { eq: $intervalSeconds } } }
            Block: { Time: { since: $from, till: $to } }
          }
        ) {
          Block { Time Timestamp }
          Interval { Time { Start End Duration } }
          Price {
            IsQuotedInUsd
            Ohlc { Open High Low Close }
          }
          Volume { Base Quote Usd }
          Token { Address Symbol Name }
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

export const ACES_WETH_POOL_ADDRESS = acesWethPoolEnv ? acesWethPoolEnv.toLowerCase() : '';
export const WETH_USDC_POOL_ADDRESS = wethUsdcPoolEnv ? wethUsdcPoolEnv.toLowerCase() : '';

// Timeframe to seconds mapping for Trading.Tokens query
export const TIMEFRAME_TO_SECONDS: Record<string, number> = {
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};
