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
import { useUnifiedChartData } from '@/hooks/chart/use-unified-chart-data';

type UnifiedHookResult = ReturnType<typeof useUnifiedChartData>;
type UnifiedCandle = UnifiedHookResult['candles'][number];
type UnifiedGraduationState = UnifiedHookResult['graduationState'];

interface TokenMetadata {
  symbol: string;
  name: string;
  currentPriceACES: string;
  volume24h: string;
}

interface UnifiedDataSubscription {
  subscriberUID: string;
  tokenAddress: string;
  timeframe: string;
  onRealtimeCallback: SubscribeBarsCallback;
  onResetCacheNeededCallback: () => void;
  isActive: boolean;
  lastBar: Bar | null;
  ws: WebSocket | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
}

interface SearchSymbol {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker: string;
  type: string;
}

interface WebSocketMessage {
  type?: string;
  error?: string;
  graduationState?: UnifiedGraduationState;
  candles?: UnifiedCandle[];
  candle?: UnifiedCandle;
}

export class BondingCurveDatafeed implements IBasicDataFeed {
  private static readonly MAX_GAP_FILL_DURATION_MS = 48 * 60 * 60 * 1000;
  private static readonly MAX_CACHED_BARS = 5000;

  // Subscript digit map for zero-count notation (0.0₅487)
  private static readonly SUBSCRIPT_MAP: Record<string, string> = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
  };

  /**
   * Formats a price with compressed leading-zeros notation
   * Examples:
   *   0.00000487 → 0.0₅487 (5 leading zeros)
   *   0.0000000123 → 0.0₈123 (8 leading zeros)
   *   0.25 → 0.2500 (standard format)
   * This prevents scientific notation (e-notation) for very small prices
   */
  public static formatPriceWithZeroCount(price: number, includeSymbol: boolean = true): string {
    if (price === 0 || price === null || price === undefined || !Number.isFinite(price)) {
      return includeSymbol ? '$0.00' : '0.00';
    }

    const absPrice = Math.abs(price);
    const sign = price < 0 ? '-' : '';
    const symbol = includeSymbol ? '$' : '';

    // Handle very small decimals (less than 0.01)
    if (absPrice < 0.01 && absPrice > 0) {
      // Convert to string with high precision
      const priceStr = absPrice.toFixed(20).replace(/\.?0+$/, '');

      // Match pattern: 0.(multiple zeros)(significant digits)
      const match = priceStr.match(/^0\.(0+)([1-9]\d*)$/);

      if (match && match[1].length >= 3) {
        // We have 3+ leading zeros - use compressed notation
        const zeroCount = match[1].length;
        const significantDigits = match[2].substring(0, 4); // Show first 4 significant digits

        // Convert zero count to subscript
        const subscriptCount = zeroCount
          .toString()
          .split('')
          .map((d) => BondingCurveDatafeed.SUBSCRIPT_MAP[d] || d)
          .join('');

        return `${sign}${symbol}0.0${subscriptCount}${significantDigits}`;
      }

      // Less than 3 zeros - use standard decimal notation
      return `${sign}${symbol}${absPrice.toFixed(8).replace(/\.?0+$/, '')}`;
    }

    // Standard formatting for larger prices
    if (absPrice >= 1) {
      return `${sign}${symbol}${absPrice.toFixed(2)}`;
    } else if (absPrice >= 0.01) {
      return `${sign}${symbol}${absPrice.toFixed(4)}`;
    }

    return `${sign}${symbol}${absPrice.toFixed(8)}`;
  }

  /**
   * Creates a price formatter function for TradingView widget
   * Use this when initializing your TradingView widget's custom_formatters
   */
  public static createPriceFormatter() {
    return {
      format: (price: number) => BondingCurveDatafeed.formatPriceWithZeroCount(price, true),
    };
  }

  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: (symbols: SearchSymbol[]) => void,
  ): void {
    onResultReadyCallback([]);
  }

  private tokenAddress: string;
  private displayCurrency: 'usd' | 'aces';
  private useDex: boolean;
  private tokenMetadata: TokenMetadata | null = null;
  private lastHistoricalBarByTimeframe = new Map<string, Bar>();
  private historyCache = new Map<string, Bar[]>();
  private unifiedDataSubscription: UnifiedDataSubscription | null = null;

  constructor(tokenAddress: string, displayCurrency: 'usd' | 'aces' = 'usd') {
    this.tokenAddress = tokenAddress.toLowerCase();
    this.displayCurrency = displayCurrency;
    this.useDex = false;
  }

  /**
   * Change display currency dynamically without recreating the datafeed
   * This allows switching between USD and ACES without breaking the WebSocket
   */
  public setDisplayCurrency(currency: 'usd' | 'aces'): void {
    // console.log(
    //   `[TradingView] Switching display currency from ${this.displayCurrency} to ${currency}`,
    // );
    this.displayCurrency = currency;
    // Clear cache to force refetch with new currency
    this.historyCache.clear();
    this.lastHistoricalBarByTimeframe.clear();
  }

  /**
   * Clear all caches - useful for debugging or forcing refresh
   */
  public clearCache(): void {
    // console.log('[TradingView] 🗑️ Clearing all caches');
    this.historyCache.clear();
    this.lastHistoricalBarByTimeframe.clear();
  }

  /**
   * Get current display currency
   */
  public getDisplayCurrency(): 'usd' | 'aces' {
    return this.displayCurrency;
  }

  private getApiUrl(path: string): string {
    if (typeof window === 'undefined') {
      return path;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiBaseUrl) {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const fullUrl = `${apiBaseUrl}/${cleanPath}`;
      return fullUrl;
    }

    // console.log('[TradingView] Using relative URL (development):', path);
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
      if (!this.tokenMetadata) {
        await this.fetchTokenMetadata();
      }

      // Ultra-high precision for micro-cap tokens to prevent scientific notation
      // Supports up to 18 decimal places to handle extremely small USD prices
      // This allows proper display of prices like 0.000000000123 as 0.0₁₀123
      // For USD mode, we need extra precision since prices can be in millionths
      const precision = 18; // Up to 18 decimal places (handles USD micro-prices)
      const pricescale = Math.pow(10, precision); // 10^18 = 1,000,000,000,000,000,000
      const minmov = 1; // Smallest possible price movement

      const symbolInfo: LibrarySymbolInfo = {
        ticker: this.tokenMetadata?.symbol || symbolName,
        name: `${this.tokenMetadata?.name || 'Token'} · ${this.tokenMetadata?.symbol || symbolName}`,
        description: `${this.tokenMetadata?.name || 'Token'} - Bonding Curve Token`,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'BondingCurve',
        minmov: minmov,
        pricescale: pricescale,
        has_intraday: true,
        has_daily: true,
        supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
        volume_precision: 2,
        data_status: 'streaming',
        listed_exchange: 'BondingCurve',
        // Use 'price' format which preserves decimal precision without scientific notation
        format: 'price',
        // Force minimum tick to be incredibly small to show micro-price movements
        // minTick: '0.000000000000000001', // 1e-18 to handle USD micro-prices
      };

      // console.log('[TradingView] Symbol resolved with zero-count notation support:', {
      //   precision,
      //   pricescale,
      //   minmov: symbolInfo.minmov,
      //   currency: this.displayCurrency,
      //   formatter: 'Zero-count notation enabled',
      // });

      setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    } catch (error) {
      console.error('[TradingView] Error resolving symbol:', error);
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
    const cachedBars = this.historyCache.get(timeframe);
    const fromMs = periodParams.from * 1000;
    const toMs = periodParams.to * 1000;

    const deliverBars = (sourceBars: Bar[], cacheSource: boolean) => {
      const filtered = sourceBars.filter((bar) => bar.time >= fromMs && bar.time <= toMs);

      if (cacheSource) {
        const cachedCopy = this.cloneBars(sourceBars);
        if (cachedCopy.length > 0) {
          this.lastHistoricalBarByTimeframe.set(timeframe, cachedCopy[cachedCopy.length - 1]);
        }
        if (cachedCopy.length > BondingCurveDatafeed.MAX_CACHED_BARS) {
          cachedCopy.splice(0, cachedCopy.length - BondingCurveDatafeed.MAX_CACHED_BARS);
        }
        this.historyCache.set(timeframe, cachedCopy);
      }

      if (filtered.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      const filteredCopy = this.cloneBars(filtered);
      this.lastHistoricalBarByTimeframe.set(timeframe, filteredCopy[filteredCopy.length - 1]);

      // Log sample price with zero-count notation to verify formatting
      if (filteredCopy.length > 0) {
        const samplePrice = filteredCopy[0].close;
        // console.log('[TradingView] 📊 Delivering bars to chart:', {
        //   count: filteredCopy.length,
        //   firstBar: {
        //     time: new Date(filteredCopy[0].time).toISOString(),
        //     open: filteredCopy[0].open,
        //     high: filteredCopy[0].high,
        //     low: filteredCopy[0].low,
        //     close: filteredCopy[0].close,
        //     hasBody: filteredCopy[0].open !== filteredCopy[0].close,
        //   },
        //   lastBar: {
        //     time: new Date(filteredCopy[filteredCopy.length - 1].time).toISOString(),
        //     open: filteredCopy[filteredCopy.length - 1].open,
        //     high: filteredCopy[filteredCopy.length - 1].high,
        //     low: filteredCopy[filteredCopy.length - 1].low,
        //     close: filteredCopy[filteredCopy.length - 1].close,
        //     hasBody:
        //       filteredCopy[filteredCopy.length - 1].open !==
        //       filteredCopy[filteredCopy.length - 1].close,
        //   },
        // });
      }

      onHistoryCallback(filteredCopy, { noData: false });
    };

    if (!periodParams.firstDataRequest && cachedBars) {
      // console.log(
      //   `[TradingView] Serving ${cachedBars.length} cached bars for ${this.tokenAddress} ${timeframe}`,
      // );
      deliverBars(cachedBars, false);
      return;
    }

    // console.log(
    //   `[TradingView] Fetching bars: ${this.tokenAddress} ${timeframe}`,
    //   `from: ${new Date(periodParams.from * 1000).toISOString()}, to: ${new Date(periodParams.to * 1000).toISOString()}`,
    // );

    // console.log('[TradingView] 📊 Time range details:', {
    //   fromUnix: periodParams.from,
    //   toUnix: periodParams.to,
    //   fromISO: new Date(periodParams.from * 1000).toISOString(),
    //   toISO: new Date(periodParams.to * 1000).toISOString(),
    //   rangeHours: ((periodParams.to - periodParams.from) / 3600).toFixed(1),
    //   firstDataRequest: periodParams.firstDataRequest,
    // });

    this.fetchHistoricalDataUnified(timeframe, periodParams.from, periodParams.to)
      .then(({ bars }) => {
        if (bars.length === 0) {
          onHistoryCallback([], { noData: true });
          this.historyCache.set(timeframe, []);
          return;
        }

        deliverBars(bars, true);
      })
      .catch((error) => {
        console.error('[TradingView] Error fetching bars:', error);
        onErrorCallback(error instanceof Error ? error.message : 'Failed to fetch chart data');
      });
  }

  private resolutionToTimeframe(resolution: ResolutionString): string {
    switch (resolution) {
      case '5':
        return '5m';
      case '15':
        return '15m';
      case '60':
        return '1h';
      case '240':
        return '4h';
      case '1D':
        return '1d';
      default:
        return '1h';
    }
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
      `[TradingView] Starting WebSocket subscription for ${this.tokenAddress} ${timeframe}`,
    );

    // Check if we already have an active subscription for this exact setup
    if (
      this.unifiedDataSubscription &&
      this.unifiedDataSubscription.tokenAddress === this.tokenAddress &&
      this.unifiedDataSubscription.timeframe === timeframe &&
      this.unifiedDataSubscription.isActive
    ) {
      console.log('[TradingView] ⚠️ Already subscribed, updating callbacks only');
      // Update callbacks without recreating WebSocket
      this.unifiedDataSubscription.onRealtimeCallback = onRealtimeCallback;
      this.unifiedDataSubscription.onResetCacheNeededCallback = onResetCacheNeededCallback;
      this.unifiedDataSubscription.subscriberUID = subscriberUID;
      return;
    }

    // Close previous subscription only if it's for a different token/timeframe
    if (this.unifiedDataSubscription) {
      console.log('[TradingView] Closing previous subscription for different token/timeframe');
      this.unsubscribeBars(this.unifiedDataSubscription.subscriberUID);
    }

    const subscription: UnifiedDataSubscription = {
      subscriberUID,
      tokenAddress: this.tokenAddress,
      timeframe,
      onRealtimeCallback,
      onResetCacheNeededCallback,
      isActive: true,
      lastBar: this.cloneBar(this.lastHistoricalBarByTimeframe.get(timeframe) || null),
      ws: null,
      reconnectTimeout: null,
    };

    this.unifiedDataSubscription = subscription;
    this.startUnifiedWebSocket();
  }

  unsubscribeBars(subscriberUID: string) {
    // console.log(`[TradingView] 🔴 Unsubscribe requested for: ${subscriberUID}`);
    // console.trace('[TradingView] Unsubscribe called from:'); // Add stack trace to see who's calling

    if (!this.unifiedDataSubscription) {
      // console.log('[TradingView] No active subscription to unsubscribe');
      return;
    }

    const subscription = this.unifiedDataSubscription;
    if (subscription.subscriberUID !== subscriberUID) {
      // console.log(
      //   `[TradingView] UID mismatch: expected ${subscription.subscriberUID}, got ${subscriberUID}`,
      // );
      return;
    }

    // console.log('[TradingView] ⚠️ Deactivating subscription and closing WebSocket');
    subscription.isActive = false;

    if (subscription.reconnectTimeout) {
      clearTimeout(subscription.reconnectTimeout);
      subscription.reconnectTimeout = null;
    }

    if (subscription.ws) {
      const ws = subscription.ws;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'unsubscribe',
            tokenAddress: this.tokenAddress,
            timeframe: subscription.timeframe,
          }),
        );
      }

      ws.close();
      subscription.ws = null;
    }

    this.unifiedDataSubscription = null;
    // console.log(`[TradingView] WebSocket unsubscribed successfully`);
  }

  private startUnifiedWebSocket() {
    if (typeof window === 'undefined') {
      // console.warn('[TradingView] WebSocket not started - window is undefined');
      return;
    }

    const subscription = this.unifiedDataSubscription;

    if (!subscription || !subscription.isActive) {
      return;
    }

    if (subscription.reconnectTimeout) {
      clearTimeout(subscription.reconnectTimeout);
      subscription.reconnectTimeout = null;
    }

    if (subscription.ws) {
      const state = subscription.ws.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        // console.log('[TradingView] WebSocket already connecting/connected');
        return;
      }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = process.env.NEXT_PUBLIC_API_URL
      ? `${protocol}//${new URL(process.env.NEXT_PUBLIC_API_URL).host}/ws/chart`
      : `${protocol}//${window.location.host}/ws/chart`;

    try {
      const ws = new WebSocket(wsUrl);
      subscription.ws = ws;

      ws.onopen = () => {
        // console.log(
        //   '[TradingView] ✅ WebSocket connected for real-time updates:',
        //   subscription.tokenAddress,
        //   subscription.timeframe,
        // );
        if (!subscription.isActive) {
          console.warn('[TradingView] ⚠️ Subscription inactive on open, closing...');
          ws.close();
          return;
        }

        const subscribeMessage = {
          type: 'subscribe',
          tokenAddress: subscription.tokenAddress,
          timeframe: subscription.timeframe,
        };
        // console.log('[TradingView] 📤 Sending subscribe message:', subscribeMessage);
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        if (!subscription.isActive) {
          return;
        }

        try {
          const message = JSON.parse(event.data);
          this.handleUnifiedWebSocketMessage(message, subscription);
        } catch (error) {
          console.error('[TradingView] WebSocket message error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[TradingView] WebSocket error:', error);
      };

      ws.onclose = (event) => {
        // console.log('[TradingView] WebSocket closed, code:', event.code);

        if (!subscription.isActive) {
          return;
        }

        subscription.ws = null;
        subscription.reconnectTimeout = setTimeout(() => {
          // console.log('[TradingView] Reconnecting WebSocket...');
          this.startUnifiedWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('[TradingView] Failed to start WebSocket:', error);
    }
  }

  private handleUnifiedWebSocketMessage(
    message: WebSocketMessage,
    subscription: UnifiedDataSubscription,
  ) {
    if (!message || typeof message !== 'object') {
      return;
    }

    const timeframeMs = this.timeframeToMs(subscription.timeframe);

    if (message.graduationState) {
      const graduationState = message.graduationState as UnifiedGraduationState;
      this.useDex = Boolean(graduationState?.poolReady);
    }

    switch (message.type) {
      case 'initial_data': {
        // console.log(`[TradingView] Initial data: ${message.candles?.length || 0} candles`);
        const candles = Array.isArray(message.candles) ? (message.candles as UnifiedCandle[]) : [];
        const bars = candles
          .map((candle) => this.candleToBar(candle, timeframeMs))
          .filter((bar): bar is Bar => Boolean(bar));

        if (bars.length === 0) {
          return;
        }

        const filledBars = this.fillMissingBars(bars, timeframeMs);
        this.historyCache.set(subscription.timeframe, this.cloneBars(filledBars));
        this.lastHistoricalBarByTimeframe.set(
          subscription.timeframe,
          filledBars[filledBars.length - 1],
        );
        subscription.lastBar = this.cloneBar(filledBars[filledBars.length - 1]);

        // DO NOT call onResetCacheNeededCallback here!
        // Calling it triggers TradingView's resetCache() which unsubscribes from real-time data.
        // Initial WebSocket data is not a cache invalidation event - it's just the initial load.
        // The subscription should stay active to receive real-time updates via candle_update messages.

        break;
      }

      case 'candle_update': {
        const bar = this.candleToBar(message.candle as UnifiedCandle, timeframeMs);

        if (!bar) {
          return;
        }

        // console.log(`[TradingView] 🔔 Real-time candle update received:`, {
        //   time: new Date(bar.time).toISOString(),
        //   close: bar.close,
        //   timeframe: subscription.timeframe,
        // });

        const bridgedBar = this.bridgeBar(subscription.lastBar, bar);
        subscription.lastBar = bridgedBar;

        try {
          subscription.onRealtimeCallback(bridgedBar);
          // console.log('[TradingView] ✅ Real-time update applied to chart');
        } catch (error) {
          console.error('[TradingView] Error calling onRealtimeCallback:', error);
        }

        this.updateHistoryCache(subscription.timeframe, bridgedBar);
        break;
      }

      case 'error': {
        console.error('[TradingView] WebSocket server error:', message.error);
        break;
      }

      default:
        break;
    }
  }

  private timeframeToMs(timeframe: string): number {
    switch (timeframe) {
      case '5m':
        return 5 * 60 * 1000;
      case '15m':
        return 15 * 60 * 1000;
      case '1h':
        return 60 * 60 * 1000;
      case '4h':
        return 4 * 60 * 60 * 1000;
      case '1d':
        return 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  private alignTimeToTimeframe(timestampMs: number, timeframeMs: number): number {
    if (timeframeMs <= 0) {
      return timestampMs;
    }
    return Math.floor(timestampMs / timeframeMs) * timeframeMs;
  }

  private candleToBar(
    candle: Partial<UnifiedCandle> | null | undefined,
    timeframeMs: number,
  ): Bar | null {
    if (!candle) {
      return null;
    }

    const rawTimestamp =
      typeof (candle as any).timestamp === 'number'
        ? (candle as any).timestamp
        : typeof (candle as any).time === 'number'
          ? (candle as any).time
          : Number((candle as any).timestamp ?? (candle as any).time ?? 0);

    if (!Number.isFinite(rawTimestamp)) {
      return null;
    }

    const timestampMs = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
    const alignedTime = this.alignTimeToTimeframe(timestampMs, timeframeMs);

    const priceFor = (key: 'open' | 'high' | 'low' | 'close'): number => {
      const usdKey = `${key}Usd`;

      // For DEX tokens (dataSource: 'dex'), ONLY use USD prices
      if ((candle as any).dataSource === 'dex') {
        const usdValue = (candle as any)[usdKey];
        const value = typeof usdValue === 'string' ? parseFloat(usdValue) : Number(usdValue ?? 0);
        return Number.isFinite(value) ? value : 0;
      }

      // For bonding curve, use existing logic
      const source =
        this.displayCurrency === 'usd'
          ? ((candle as any)[usdKey] ?? (candle as any)[key])
          : (candle as any)[key];

      const value = typeof source === 'string' ? parseFloat(source) : Number(source ?? 0);
      return Number.isFinite(value) ? value : 0;
    };

    const open = priceFor('open');
    const high = priceFor('high') || open;
    const low = priceFor('low') || open;
    const close = priceFor('close') || open;
    const volume = Number((candle as any).volume ?? 0);

    if (
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      return null;
    }

    if (open <= 0 && high <= 0 && low <= 0 && close <= 0) {
      return null;
    }

    return {
      time: alignedTime,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    };
  }

  private fillMissingBars(bars: Bar[], timeframeMs: number): Bar[] {
    if (bars.length === 0) {
      return [];
    }

    const filled: Bar[] = [];
    const sortedBars = [...bars].sort((a, b) => a.time - b.time);

    filled.push(sortedBars[0]);

    for (let i = 1; i < sortedBars.length; i++) {
      const prevBar = sortedBars[i - 1];
      const currentBar = sortedBars[i];
      const timeDiff = currentBar.time - prevBar.time;

      if (timeDiff > timeframeMs && timeDiff <= BondingCurveDatafeed.MAX_GAP_FILL_DURATION_MS) {
        const numMissingBars = Math.floor(timeDiff / timeframeMs) - 1;

        for (let j = 1; j <= numMissingBars; j++) {
          const syntheticTime = prevBar.time + j * timeframeMs;
          const syntheticBar: Bar = {
            time: syntheticTime,
            open: prevBar.close,
            high: prevBar.close,
            low: prevBar.close,
            close: prevBar.close,
            volume: 0,
          };
          filled.push(syntheticBar);
        }
      }

      filled.push(currentBar);
    }

    return filled;
  }

  private async fetchTokenMetadata(): Promise<void> {
    try {
      const apiUrl = this.getApiUrl(`/api/v1/tokens/${this.tokenAddress}`);
      const response = await window.fetch(apiUrl);

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
      console.error('[TradingView] Error fetching token metadata:', error);
      this.tokenMetadata = {
        symbol: 'TOKEN',
        name: 'Unknown Token',
        currentPriceACES: '0',
        volume24h: '0',
      };
    }
  }

  private async fetchHistoricalDataUnified(
    timeframe: string,
    from: number,
    to: number,
  ): Promise<{ bars: Bar[] }> {
    if (!this.tokenAddress || !this.tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error('[TradingView] Invalid token address:', this.tokenAddress);
      throw new Error('Invalid token address format');
    }

    const apiUrl = this.getApiUrl(`/api/v1/chart/${this.tokenAddress}`);
    const params = new URLSearchParams({
      timeframe,
      includeUsd: 'true',
      from: from.toString(),
      to: to.toString(),
    });

    // console.log(`[TradingView] Fetching: ${apiUrl}?${params.toString()}`);

    const response = await window.fetch(`${apiUrl}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data?.candles) {
      throw new Error('No chart data available');
    }

    const candles = data.data.candles;
    const timeframeMs = this.timeframeToMs(timeframe);

    const bars: Bar[] = candles
      .map((candle: any) => {
        const timestamp = candle.timestamp * 1000;

        const open =
          this.displayCurrency === 'usd'
            ? parseFloat(candle.openUsd || candle.open)
            : parseFloat(candle.open);

        const high =
          this.displayCurrency === 'usd'
            ? parseFloat(candle.highUsd || candle.high)
            : parseFloat(candle.high);

        const low =
          this.displayCurrency === 'usd'
            ? parseFloat(candle.lowUsd || candle.low)
            : parseFloat(candle.low);

        const close =
          this.displayCurrency === 'usd'
            ? parseFloat(candle.closeUsd || candle.close)
            : parseFloat(candle.close);

        // DEBUG: Log first candle processing
        if (timestamp === candles[0].timestamp * 1000) {
          console.log('🔍 [Frontend Datafeed] Processing first candle:', {
            displayCurrency: this.displayCurrency,
            candleOpenAces: candle.open,
            candleOpenUsd: candle.openUsd,
            candleCloseAces: candle.close,
            candleCloseUsd: candle.closeUsd,
            selectedOpen: open,
            selectedClose: close,
            usedUsdValue: this.displayCurrency === 'usd',
          });
        }

        return {
          time: timestamp,
          open,
          high,
          low,
          close,
          volume: parseFloat(candle.volume || '0'),
        };
      })
      .filter((bar: Bar) => {
        const hasValidPrices = bar.open > 0 || bar.high > 0 || bar.low > 0 || bar.close > 0;
        return hasValidPrices;
      })
      .sort((a: Bar, b: Bar) => a.time - b.time);

    // console.log(`[TradingView] Returning ${bars.length} bars`);

    if (bars.length > 0) {
      // console.log('[TradingView] First bar:', {
      //   time: new Date(bars[0].time).toISOString(),
      //   raw: bars[0].close,
      //   formatted: BondingCurveDatafeed.formatPriceWithZeroCount(bars[0].close),
      // //  });
      // console.log('[TradingView] Last bar:', {
      //   time: new Date(bars[bars.length - 1].time).toISOString(),
      //   raw: bars[bars.length - 1].close,
      //   formatted: BondingCurveDatafeed.formatPriceWithZeroCount(bars[bars.length - 1].close),
      // });
    }

    const filledBars = this.fillMissingBars(bars, timeframeMs);

    return { bars: filledBars };
  }

  private bridgeBar(previousBar: Bar | null, bar: Bar): Bar {
    if (!bar) {
      return bar;
    }

    const bridged: Bar = { ...bar };

    if (!previousBar || previousBar.time === bridged.time) {
      return bridged;
    }

    const prevClose = previousBar.close;

    if (!Number.isFinite(prevClose)) {
      return bridged;
    }

    bridged.open = prevClose;
    bridged.high = Math.max(bridged.high, prevClose);
    bridged.low = Math.min(bridged.low, prevClose);

    return bridged;
  }

  private cloneBar(bar: Bar | null): Bar | null {
    if (!bar) {
      return null;
    }

    return { ...bar };
  }

  private cloneBars(bars: Bar[]): Bar[] {
    return bars.map((bar) => ({ ...bar }));
  }

  private updateHistoryCache(timeframe: string, bar: Bar) {
    const clonedBar = { ...bar };
    const existing = this.historyCache.get(timeframe);

    if (!existing || existing.length === 0) {
      this.historyCache.set(timeframe, [clonedBar]);
      this.lastHistoricalBarByTimeframe.set(timeframe, clonedBar);
      return;
    }

    const updated = [...existing];
    const lastIndex = updated.length - 1;

    if (updated[lastIndex].time === clonedBar.time) {
      updated[lastIndex] = clonedBar;
    } else if (clonedBar.time > updated[lastIndex].time) {
      updated.push(clonedBar);
    } else {
      const insertIndex = updated.findIndex((cachedBar) => cachedBar.time > clonedBar.time);

      if (insertIndex === -1) {
        updated.push(clonedBar);
      } else if (updated[insertIndex].time === clonedBar.time) {
        updated[insertIndex] = clonedBar;
      } else {
        updated.splice(insertIndex, 0, clonedBar);
      }
    }

    if (updated.length > BondingCurveDatafeed.MAX_CACHED_BARS) {
      updated.splice(0, updated.length - BondingCurveDatafeed.MAX_CACHED_BARS);
    }

    this.historyCache.set(timeframe, updated);
    this.lastHistoricalBarByTimeframe.set(timeframe, updated[updated.length - 1]);
  }
}
