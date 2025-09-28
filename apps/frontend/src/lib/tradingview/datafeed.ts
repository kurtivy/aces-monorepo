import {
  IBasicDataFeed,
  LibrarySymbolInfo,
  OnReadyCallback,
  ResolveCallback,
  HistoryCallback,
  SubscribeBarsCallback,
  Bar,
  ResolutionString,
} from '../../../public/charting_library/charting_library';

interface TokenMetadata {
  symbol: string;
  name: string;
  currentPriceACES: string;
  volume24h: string;
}

export class BondingCurveDatafeed implements IBasicDataFeed {
  // Required by IDatafeedChartApi but not used in basic implementation
  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: (symbols: any[]) => void,
  ): void {
    // Not implemented for basic datafeed
    onResultReadyCallback([]);
  }
  private tokenAddress: string;
  private realtimeSubscriptions = new Map<string, any>();
  private tokenMetadata: TokenMetadata | null = null;
  private realtimeHook: any = null;

  constructor(tokenAddress: string) {
    this.tokenAddress = tokenAddress.toLowerCase();
  }

  onReady(callback: OnReadyCallback) {
    setTimeout(() => {
      callback({
        supported_resolutions: ['1', '5', '15', '60', '240', '1D'] as ResolutionString[],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        symbols_types: [
          {
            name: 'crypto',
            value: 'crypto',
          },
        ],
      });
    }, 0);
  }

  async resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: ResolveCallback,
    onResolveErrorCallback: (reason: string) => void,
  ) {
    try {
      // Fetch token metadata from backend
      if (!this.tokenMetadata) {
        await this.fetchTokenMetadata();
      }

      const symbolInfo: LibrarySymbolInfo = {
        ticker: this.tokenMetadata?.symbol || symbolName,
        name: `${this.tokenMetadata?.name || 'Token'} · ${this.tokenMetadata?.symbol || symbolName}`,
        description: `${this.tokenMetadata?.name || 'Token'} - Bonding Curve Token`,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'BondingCurve',
        minmov: 1,
        pricescale: 1000000, // 6 decimal places
        has_intraday: true,
        has_daily: true,
        supported_resolutions: ['1', '5', '15', '60', '240', '1D'] as ResolutionString[],
        volume_precision: 2,
        data_status: 'streaming',
        listed_exchange: 'BondingCurve',
        format: 'price',
      };

      setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    } catch (error) {
      console.error('Error resolving symbol:', error);
      onResolveErrorCallback(error instanceof Error ? error.message : 'Failed to resolve symbol');
    }
  }

  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: {
      from: number;
      to: number;
      firstDataRequest: boolean;
    },
    onHistoryCallback: HistoryCallback,
    onErrorCallback: (error: string) => void,
  ) {
    this.fetchHistoricalData(resolution, periodParams.from, periodParams.to)
      .then((bars) => {
        onHistoryCallback(bars, { noData: bars.length === 0 });
      })
      .catch((error) => {
        console.error('Error fetching historical data:', error);
        onErrorCallback(error.message);
      });
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onRealtimeCallback: SubscribeBarsCallback,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void,
  ) {
    const timeframe = this.resolutionToTimeframe(resolution);

    console.log(
      `[TradingView] Starting centralized real-time subscription for ${this.tokenAddress} ${timeframe}`,
    );

    // Create a subscription object that will integrate with useRealtimeChart hook
    const subscription = {
      tokenAddress: this.tokenAddress,
      timeframe,
      onRealtimeCallback,
      onResetCacheNeededCallback,
      isActive: true,
    };

    // Store subscription for management
    this.realtimeSubscriptions.set(subscriberUID, subscription);

    // Start polling through centralized system
    this.startCentralizedPolling(subscription, subscriberUID);
  }

  unsubscribeBars(subscriberUID: string) {
    const subscription = this.realtimeSubscriptions.get(subscriberUID);
    if (subscription) {
      subscription.isActive = false;
      this.stopCentralizedPolling(subscriberUID);
      this.realtimeSubscriptions.delete(subscriberUID);
      console.log(
        `[TradingView] Unsubscribed from centralized real-time updates: ${subscriberUID}`,
      );
    }
  }

  private startCentralizedPolling(subscription: any, subscriberUID: string) {
    // Use the same polling approach as useRealtimeChart hook for consistency
    const interval = setInterval(async () => {
      if (!subscription.isActive) {
        clearInterval(interval);
        return;
      }

      try {
        const response = await fetch(
          `/api/v1/tokens/${subscription.tokenAddress}/live?timeframe=${subscription.timeframe}&since=${Math.floor((Date.now() - 60000) / 1000)}`,
        );

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data.candles.length > 0) {
          const latestCandle = data.data.candles[data.data.candles.length - 1];
          const volumeEntry = data.data.volume?.find((v: any) => v.time === latestCandle.time);

          const bar: Bar = {
            time: latestCandle.time * 1000, // TradingView expects milliseconds
            open: latestCandle.open,
            high: latestCandle.high,
            low: latestCandle.low,
            close: latestCandle.close,
            volume: volumeEntry?.value || 0,
          };

          subscription.onRealtimeCallback(bar);
        }
      } catch (error) {
        console.error(`[TradingView] Centralized polling error for ${subscriberUID}:`, error);
        // Continue polling despite errors
      }
    }, 5000); // 5-second updates as per plan

    // Store interval for cleanup
    subscription.interval = interval;
  }

  private stopCentralizedPolling(subscriberUID: string) {
    const subscription = this.realtimeSubscriptions.get(subscriberUID);
    if (subscription && subscription.interval) {
      clearInterval(subscription.interval);
      subscription.interval = null;
    }
  }

  private async fetchTokenMetadata(): Promise<void> {
    try {
      const response = await fetch(`/api/v1/tokens/${this.tokenAddress}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch token metadata: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        this.tokenMetadata = {
          symbol: result.data.symbol || 'TOKEN',
          name: result.data.name || 'Unknown Token',
          currentPriceACES: result.data.currentPriceACES || '0',
          volume24h: result.data.volume24h || '0',
        };
      }
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      // Set fallback metadata
      this.tokenMetadata = {
        symbol: 'TOKEN',
        name: 'Unknown Token',
        currentPriceACES: '0',
        volume24h: '0',
      };
    }
  }

  private async fetchHistoricalData(
    resolution: ResolutionString,
    from: number,
    to: number,
  ): Promise<Bar[]> {
    const timeframe = this.resolutionToTimeframe(resolution);

    console.log(
      `[TradingView] Fetching historical data: ${this.tokenAddress} ${timeframe} from ${from} to ${to}`,
    );

    const response = await fetch(
      `/api/v1/tokens/${this.tokenAddress}/chart?timeframe=${timeframe}&mode=hybrid&limit=1000`,
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'API returned error');
    }

    // Filter data by time range and convert to TradingView format
    const bars = data.data.candles
      .filter((candle: any) => candle.time >= from && candle.time <= to)
      .map((candle: any, index: number) => {
        const volumeEntry = data.data.volume?.[index];

        return {
          time: candle.time * 1000, // TradingView expects milliseconds
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: volumeEntry?.value || 0,
        };
      });

    console.log(`[TradingView] Fetched ${bars.length} bars for ${timeframe}`);
    return bars;
  }

  private resolutionToTimeframe(resolution: ResolutionString): string {
    const mapping: Record<string, string> = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '60': '1h',
      '240': '4h',
      '1D': '1d',
    };
    return mapping[resolution] || '1h';
  }
}
