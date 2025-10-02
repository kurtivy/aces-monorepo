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

  constructor(tokenAddress: string) {
    this.tokenAddress = tokenAddress.toLowerCase();
  }

  /**
   * Get the correct API URL based on environment
   * In production/Vercel, use NEXT_PUBLIC_API_URL
   * In development, use relative URL (proxied by next.config.ts)
   */
  private getApiUrl(path: string): string {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return path;
    }

    // In production/Vercel, use the environment variable
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiBaseUrl) {
      // Remove leading slash from path since apiBaseUrl should include it
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const fullUrl = `${apiBaseUrl}/${cleanPath}`;
      console.log('[TradingView] Using API URL:', fullUrl);
      return fullUrl;
    }

    // In development, use relative URL (will be proxied)
    console.log('[TradingView] Using relative URL (development):', path);
    return path;
  }

  onReady(callback: OnReadyCallback) {
    setTimeout(() => {
      callback({
        supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
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
        supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
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
    const timeframe = this.resolutionToTimeframe(resolution);

    console.log(
      `[TradingView] Fetching bars: ${this.tokenAddress} ${timeframe}`,
      `from: ${new Date(periodParams.from * 1000).toISOString()}, to: ${new Date(periodParams.to * 1000).toISOString()}`,
    );

    // Fetch data from backend (has 10-second cache)
    this.fetchHistoricalData(resolution, periodParams.from, periodParams.to)
      .then((bars) => {
        onHistoryCallback(bars, { noData: bars.length === 0 });
      })
      .catch((error) => {
        console.error('[TradingView] Error fetching bars:', error);
        onErrorCallback(error instanceof Error ? error.message : 'Failed to fetch chart data');
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
      `[TradingView] Starting real-time subscription for ${this.tokenAddress} ${timeframe}`,
    );

    const subscription = {
      tokenAddress: this.tokenAddress,
      timeframe,
      onRealtimeCallback,
      onResetCacheNeededCallback,
      isActive: true,
      lastBar: null as Bar | null,
    };

    this.realtimeSubscriptions.set(subscriberUID, subscription);
    this.startRealtimePolling(subscription, subscriberUID);
  }

  unsubscribeBars(subscriberUID: string) {
    const subscription = this.realtimeSubscriptions.get(subscriberUID);
    if (subscription) {
      subscription.isActive = false;
      this.stopRealtimePolling(subscriberUID);
      this.realtimeSubscriptions.delete(subscriberUID);
      console.log(`[TradingView] Unsubscribed from real-time updates: ${subscriberUID}`);
    }
  }

  private startRealtimePolling(subscription: any, subscriberUID: string) {
    const interval = setInterval(async () => {
      if (!subscription.isActive) {
        clearInterval(interval);
        return;
      }

      try {
        // Fetch only the current candle
        const apiUrl = this.getApiUrl(
          `/api/v1/tokens/${subscription.tokenAddress}/live?timeframe=${subscription.timeframe}`,
        );
        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data.candles.length > 0) {
          const latestCandle = data.data.candles[0];
          const volumeEntry = data.data.volume?.[0];

          const bar: Bar = {
            time: latestCandle.time * 1000, // TradingView expects milliseconds
            open: Number(latestCandle.open) || 0,
            high: Number(latestCandle.high) || 0,
            low: Number(latestCandle.low) || 0,
            close: Number(latestCandle.close) || 0,
            volume: volumeEntry?.value ? Number(volumeEntry.value) : 0,
          };

          // Only send update if bar has changed
          if (
            !subscription.lastBar ||
            subscription.lastBar.time !== bar.time ||
            subscription.lastBar.close !== bar.close ||
            subscription.lastBar.volume !== bar.volume
          ) {
            subscription.lastBar = bar;
            subscription.onRealtimeCallback(bar);

            console.log(`[TradingView] Real-time update:`, {
              time: new Date(bar.time).toISOString(),
              price: bar.close,
              volume: bar.volume,
            });
          }
        }
      } catch (error) {
        console.error(`[TradingView] Polling error for ${subscriberUID}:`, error);
        // Continue polling despite errors
      }
    }, 5000); // Poll every 5 seconds

    subscription.interval = interval;
  }

  private stopRealtimePolling(subscriberUID: string) {
    const subscription = this.realtimeSubscriptions.get(subscriberUID);
    if (subscription && subscription.interval) {
      clearInterval(subscription.interval);
      subscription.interval = null;
    }
  }

  private async fetchTokenMetadata(): Promise<void> {
    try {
      const apiUrl = this.getApiUrl(`/api/v1/tokens/${this.tokenAddress}`);
      const response = await fetch(apiUrl);

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

    // Validate token address
    if (!this.tokenAddress || !this.tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error('[TradingView] Invalid token address:', this.tokenAddress);
      throw new Error('Invalid token address format');
    }

    const apiPath = `/api/v1/tokens/${this.tokenAddress}/chart?timeframe=${timeframe}&limit=5000`;
    const apiUrl = this.getApiUrl(apiPath);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || data.message || 'API returned error');
    }

    // Convert to TradingView format
    const allBars: Bar[] = [];

    console.log(
      `[TradingView] Received ${data.data.candles.length} bars, filtering to range [${from} - ${to}]`,
    );

    for (let i = 0; i < data.data.candles.length; i++) {
      const candle = data.data.candles[i];
      const volumeEntry = data.data.volume?.[i];

      // Filter by time range (TradingView sends timestamps in seconds)
      if (candle.time >= from && candle.time <= to) {
        const bar: Bar = {
          time: candle.time * 1000, // TradingView expects milliseconds
          open: Number(candle.open) || 0,
          high: Number(candle.high) || 0,
          low: Number(candle.low) || 0,
          close: Number(candle.close) || 0,
          volume: volumeEntry?.value ? Number(volumeEntry.value) : 0,
        };

        // Skip invalid bars
        if (bar.open > 0 || bar.high > 0 || bar.low > 0 || bar.close > 0) {
          allBars.push(bar);
        }
      }
    }

    // Sort bars in ascending time order (TradingView requirement)
    allBars.sort((a, b) => a.time - b.time);

    console.log(`[TradingView] Returning ${allBars.length} bars matching time range`);

    return allBars;
  }

  private resolutionToTimeframe(resolution: ResolutionString): string {
    const mapping: Record<string, string> = {
      '5': '5m',
      '15': '15m',
      '60': '1h',
      '240': '4h',
      '1D': '1d',
    };
    return mapping[resolution] || '1h';
  }
}
