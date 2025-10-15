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

export interface BitQueryTradingResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
  }>;
}

export interface TradingTokensOHLC {
  Block: {
    Time: string;
    Timestamp: string;
  };
  Interval: {
    Time: {
      Start: string;
      End: string;
      Duration: number;
    };
  };
  Price: {
    IsQuotedInUsd: boolean;
    Ohlc: {
      Open: number;
      High: number;
      Low: number;
      Close: number;
    };
  };
  Volume: {
    Base: number;
    Quote: number;
    Usd: number;
  };
  Token: {
    Address: string;
    Symbol: string;
    Name: string;
  };
}

export interface TradingTokensResponse {
  Trading: {
    Tokens: TradingTokensOHLC[];
  };
}

export interface LatestPriceResponse {
  Trading: {
    Tokens: Array<{
      Block: { Time: string };
      Price: {
        Ohlc: {
          Close: number;
        };
      };
    }>;
  };
}
