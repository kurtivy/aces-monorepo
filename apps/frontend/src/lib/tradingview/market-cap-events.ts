type MarketCapUpdateSource = 'price' | 'mcap';

export interface MarketCapUpdate {
  tokenAddress: string;
  marketCapUsd: number;
  currentPriceUsd?: number;
  circulatingSupply?: number;
  timestamp: number;
  source: MarketCapUpdateSource;
}

type Listener = (update: MarketCapUpdate) => void;

const listeners = new Set<Listener>();

export function emitMarketCapUpdate(update: MarketCapUpdate): void {
  if (!update.tokenAddress) {
    return;
  }

  listeners.forEach((listener) => {
    try {
      listener(update);
    } catch (error) {
      console.error('[MarketCapEvents] Listener error:', error);
    }
  });
}

export function subscribeToMarketCapUpdates(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
