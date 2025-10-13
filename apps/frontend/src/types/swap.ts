export type PaymentToken = 'ACES' | 'WETH' | 'USDC' | 'USDT';
export type SwapToken = PaymentToken | 'TOKEN';

export interface TokenOption {
  symbol: SwapToken;
  name: string;
  icon: string;
  enabled: boolean;
  comingSoon?: boolean;
  tooltip?: string;
}

export interface SwapSupport {
  bonding: {
    supported: SwapToken[];
    comingSoon: PaymentToken[];
  };
  dex: {
    supported: SwapToken[];
  };
}
