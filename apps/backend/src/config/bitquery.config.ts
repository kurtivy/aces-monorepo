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
          }
          Trade {
            Sender
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
          }
          Trade {
            Sender
          }
        }
      }
    }
  `,

  // Get OHLC data (aggregated candles)
  GET_OHLC_CANDLES: `
    query GetOHLCCandles(
      $network: evm_network
      $poolAddress: String!
      $from: DateTime!
      $to: DateTime!
      $interval: Int!
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
              Time: { since: $from, till: $to }
            }
          }
        ) {
          Block {
            Time(interval: { in: seconds, count: $interval })
          }
          count
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
};

export const BASE_NETWORK = 'base'; // BitQuery network identifier for Base
