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

  // Client-side caching for instant timeframe changes
  private candleCache = new Map<string, { bars: Bar[]; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache

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
    const timeframe = this.resolutionToTimeframe(resolution);
    const cacheKey = `${this.tokenAddress}-${timeframe}`;

    // Check cache first for instant response
    const cached = this.candleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[TradingView] Using cached data for ${timeframe} (instant response)`);
      const filteredBars = cached.bars.filter(
        (bar) => bar.time >= periodParams.from * 1000 && bar.time <= periodParams.to * 1000,
      );
      // TradingView docs: Always call with {noData: true} if no bars available
      onHistoryCallback(filteredBars, { noData: filteredBars.length === 0 });
      return;
    }

    // Fetch fresh data
    this.fetchHistoricalData(resolution, periodParams.from, periodParams.to, cacheKey)
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
      lastBar: null as Bar | null, // Track last bar to prevent duplicate updates
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
        // Request last 5 minutes of data to ensure we get the current candle
        const fiveMinutesAgo = Math.floor((Date.now() - 5 * 60 * 1000) / 1000);
        const apiUrl = this.getApiUrl(
          `/api/v1/tokens/${subscription.tokenAddress}/live?timeframe=${subscription.timeframe}&since=${fiveMinutesAgo}`,
        );
        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data.candles.length > 0) {
          const latestIndex = data.data.candles.length - 1;
          const latestCandle = data.data.candles[latestIndex];
          const volumeEntry = data.data.volume?.[latestIndex];

          const bar: Bar = {
            time: latestCandle.time * 1000, // TradingView expects milliseconds
            open: latestCandle.open,
            high: latestCandle.high,
            low: latestCandle.low,
            close: latestCandle.close,
            volume: volumeEntry?.value || 0,
          };

          // Only send update if bar has changed (prevents duplicate updates)
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
    cacheKey: string,
  ): Promise<Bar[]> {
    const timeframe = this.resolutionToTimeframe(resolution);

    console.log(
      `[TradingView] Fetching historical data: ${this.tokenAddress} ${timeframe}`,
      `from: ${new Date(from * 1000).toISOString()}, to: ${new Date(to * 1000).toISOString()}`,
    );

    // Validate token address before making request
    if (!this.tokenAddress || !this.tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error('[TradingView] Invalid token address:', this.tokenAddress);
      throw new Error('Invalid token address format');
    }

    // Use 'hybrid' mode for optimal performance
    // Combines cached historical data with fresh live data
    const apiPath = `/api/v1/tokens/${this.tokenAddress}/chart?timeframe=${timeframe}&mode=hybrid&limit=5000`;
    const apiUrl = this.getApiUrl(apiPath);
    console.log('[TradingView] Full API URL:', apiUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      // Try to get error details from response
      let errorDetails = `API request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('[TradingView] Backend Error Response:', errorData);
        errorDetails = errorData.message || errorData.error || errorDetails;
      } catch (e) {
        // Response wasn't JSON, use status text
        const text = await response.text();
        console.error('[TradingView] Non-JSON error response:', text.substring(0, 200));
      }
      throw new Error(errorDetails);
    }

    const data = await response.json();
    console.log('[TradingView] API Response:', {
      success: data.success,
      candleCount: data.data?.candles?.length || 0,
      dataSource: data.data?.dataSource,
    });

    if (!data.success) {
      console.error('[TradingView] API Error Response:', data);
      throw new Error(data.error || data.message || 'API returned error');
    }

    // Convert to TradingView format with proper volume mapping
    const allBars: Bar[] = [];

    console.log(
      `[TradingView] Backend returned ${data.data.candles.length} candles for ${timeframe}`,
    );

    for (let i = 0; i < data.data.candles.length; i++) {
      const candle = data.data.candles[i];
      const volumeEntry = data.data.volume?.[i];

      // Filter by time range (TradingView sends timestamps in seconds, our data is also in seconds)
      if (candle.time >= from && candle.time <= to) {
        // Validate OHLC data
        const bar: Bar = {
          time: candle.time * 1000, // TradingView expects milliseconds
          open: Number(candle.open) || 0,
          high: Number(candle.high) || 0,
          low: Number(candle.low) || 0,
          close: Number(candle.close) || 0,
          volume: volumeEntry?.value ? Number(volumeEntry.value) : 0,
        };

        // Skip invalid bars (all zeros or invalid values)
        if (bar.open > 0 || bar.high > 0 || bar.low > 0 || bar.close > 0) {
          allBars.push(bar);
        }
      }
    }

    console.log(
      `[TradingView] After filtering: ${allBars.length} bars match time range [${from} - ${to}]`,
    );

    // Sort bars in ascending time order (TradingView requirement)
    allBars.sort((a, b) => a.time - b.time);

    // Cache the results for instant subsequent requests
    this.candleCache.set(cacheKey, {
      bars: allBars,
      timestamp: Date.now(),
    });

    console.log(`[TradingView] Cached ${allBars.length} bars for ${timeframe}`);

    // DEBUG: Show sample of bars being returned
    if (allBars.length > 0) {
      console.log('[TradingView] First bar:', allBars[0]);
      console.log('[TradingView] Last bar:', allBars[allBars.length - 1]);
      console.log('[TradingView] Sample bars:', allBars.slice(0, 3));

      // Check for empty candles (where open=high=low=close)
      const emptyCandles = allBars.filter(
        (b) => b.open === b.high && b.high === b.low && b.low === b.close,
      );
      const candlesWithTrades = allBars.length - emptyCandles.length;

      console.log(
        `[TradingView] Candle analysis: ${candlesWithTrades} with trades, ${emptyCandles.length} empty (${Math.round((emptyCandles.length / allBars.length) * 100)}% empty)`,
      );

      if (emptyCandles.length === allBars.length) {
        console.error(
          '[TradingView] ⚠️  ALL CANDLES ARE EMPTY - No trades found! This will display as flat lines, not candlesticks.',
        );
      }

      // Check for duplicate times
      const times = allBars.map((b) => b.time);
      const uniqueTimes = new Set(times);
      if (times.length !== uniqueTimes.size) {
        console.warn('[TradingView] WARNING: Duplicate timestamps detected!');
      }
    }

    // If no data found, try forcing generation from subgraph
    if (allBars.length === 0) {
      console.warn(`[TradingView] No cached data for ${timeframe}, attempting fresh generation`);

      try {
        // This will trigger backend to generate and store fresh candles
        await fetch(
          this.getApiUrl(
            `/api/v1/tokens/${this.tokenAddress}/live?timeframe=${timeframe}&since=${from}`,
          ),
        );

        // Brief delay to allow backend to store data
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Retry the request
        const retryResponse = await fetch(
          this.getApiUrl(
            `/api/v1/tokens/${this.tokenAddress}/chart?timeframe=${timeframe}&mode=hybrid&limit=5000`,
          ),
        );

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();

          if (retryData.success && retryData.data.candles.length > 0) {
            console.log(`[TradingView] Retry successful: ${retryData.data.candles.length} candles`);

            return retryData.data.candles
              .filter((candle: any) => candle.time >= from && candle.time <= to)
              .map((candle: any, index: number) => ({
                time: candle.time * 1000,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: retryData.data.volume?.[index]?.value || 0,
              }));
          }
        }
      } catch (retryError) {
        console.error('[TradingView] Retry failed:', retryError);
      }
    }

    return allBars;
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
