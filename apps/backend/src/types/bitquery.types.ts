export interface BitQuerySwap {
  blockTime: Date;
  blockNumber: number;
  txHash: string;
  sender: string; // Address of the trader who initiated the swap
  priceInAces: string;
  priceInUsd: string;
  amountToken: string;
  amountAces: string;
  volumeUsd: string;
  side: 'buy' | 'sell'; // From token holder perspective
}

export interface BitQueryCandle {
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  openUsd: string;
  highUsd: string;
  lowUsd: string;
  closeUsd: string;
  volume: string;
  volumeUsd: string;
  trades: number;
}

export interface BitQueryPoolState {
  poolAddress: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  lastUpdated: Date;
  blockNumber: number;
}

export interface BitQueryResponse<T> {
  data: {
    EVM: T;
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
  }>;
}
