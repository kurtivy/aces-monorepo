/**
 * External Adapter Types
 * Phase 2 - External Data Source Adapters
 */

/**
 * Base adapter interface
 */
export interface BaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStats(): AdapterStats;
}

/**
 * Adapter statistics
 */
export interface AdapterStats {
  name: string;
  connected: boolean;
  messagesReceived: number;
  messagesEmitted: number;
  errors: number;
  lastMessageAt: number | null;
  connectionUptime: number;
}

/**
 * Trade event from Goldsky/BitQuery
 */
export interface TradeEvent {
  id: string; // Transaction hash or unique ID
  tokenAddress: string;
  trader: string;
  isBuy: boolean;
  tokenAmount: string; // Raw amount (wei/decimals)
  acesAmount: string; // Raw ACES amount
  pricePerToken: string; // Calculated price
  priceUsd?: string; // USD price if available
  supply: string; // Total supply after trade
  timestamp: number; // Unix timestamp (seconds)
  blockNumber: number;
  transactionHash: string;
  dataSource: 'goldsky' | 'bitquery';
}

/**
 * Pool state from Aerodrome/DEX
 */
export interface PoolStateEvent {
  poolAddress: string;
  tokenAddress: string;
  reserve0: string; // Raw reserves
  reserve1: string;
  priceToken0: string; // Calculated prices
  priceToken1: string;
  blockNumber: number;
  timestamp: number;
  dataSource: 'aerodrome' | 'quicknode';
}

/**
 * Blockchain log event from QuickNode
 */
export interface BlockchainLogEvent {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  removed: boolean;
}

/**
 * New block header from QuickNode
 */
export interface BlockHeaderEvent {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
}

/**
 * Candle/OHLCV data
 */
export interface CandleData {
  timestamp: number; // Candle start time
  timeframe: string; // e.g., "1m", "5m", "15m"
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number;
  openUsd?: string;
  highUsd?: string;
  lowUsd?: string;
  closeUsd?: string;
  volumeUsd?: string;
  dataSource: 'bitquery' | 'goldsky' | 'aggregated';
}

/**
 * Bonding status event
 */
export interface BondingStatusEvent {
  tokenAddress: string;
  isBonded: boolean;
  supply: string;
  bondingProgress: number; // 0-1 (0% to 100%)
  poolAddress?: string; // Only when bonded
  graduatedAt?: number; // Timestamp when graduated
}

/**
 * Adapter event types
 */
export enum AdapterEventType {
  TRADE = 'trade',
  POOL_STATE = 'pool_state',
  CANDLE = 'candle',
  BONDING_STATUS = 'bonding_status',
  BLOCK = 'block',
  LOG = 'log',
  ERROR = 'error',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
}

/**
 * Generic adapter event
 */
export interface AdapterEvent<T = any> {
  type: AdapterEventType;
  data: T;
  timestamp: number;
  source: string; // Adapter name
}

