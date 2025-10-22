import {
  IBasicDataFeed,
  LibrarySymbolInfo,
  ResolutionString,
  Bar,
  OnReadyCallback,
  ResolveCallback,
  HistoryCallback,
  SubscribeBarsCallback,
} from '../../../public/charting_library/charting_library';
import {
  alignTimeToTimeframe,
  bridgeBar,
  cloneBar,
  ensureValidOhlc,
  fillMissingBars,
  normaliseTimestamp,
} from './utils/candles';

interface McapDataSubscription {
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

interface MarketCapCandle {
  timestamp: number;
  time?: number;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  marketCap?: number | string;
  marketCapUsd?: number | string;
  marketCapAces?: number | string;
  volume?: number | string;
}

export class MarketCapDatafeed implements IBasicDataFeed {
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
   * Formats a value with compressed leading-zeros notation for small values
   * and K/M/B notation for large values (market cap)
   * Examples:
   *   0.00000487 → 0.0₅487 (5 leading zeros)
   *   20000 → $20.0K
   *   100000 → $100.0K
   *   1000000 → $1.0M
   *   1000000000 → $1.0B
   */
  public static formatPriceWithZeroCount(value: number, includeSymbol: boolean = true): string {
    if (value === 0 || value === null || value === undefined || !Number.isFinite(value)) {
      return includeSymbol ? '$0.00' : '0.00';
    }

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    const symbol = includeSymbol ? '$' : '';

    // Handle large values with K/M/B notation (for market cap)
    if (absValue >= 1000) {
      if (absValue >= 1000000000) {
        // Billions
        const billions = absValue / 1000000000;
        return `${sign}${symbol}${billions.toFixed(1)}B`;
      } else if (absValue >= 1000000) {
        // Millions
        const millions = absValue / 1000000;
        return `${sign}${symbol}${millions.toFixed(1)}M`;
      } else {
        // Thousands
        const thousands = absValue / 1000;
        return `${sign}${symbol}${thousands.toFixed(1)}K`;
      }
    }

    // Handle very small decimals (less than 0.01)
    if (absValue < 0.01 && absValue > 0) {
      // Convert to string with high precision
      const valueStr = absValue.toFixed(20).replace(/\.?0+$/, '');

      // Match pattern: 0.(multiple zeros)(significant digits)
      const match = valueStr.match(/^0\.(0+)([1-9]\d*)$/);

      if (match && match[1].length >= 3) {
        // We have 3+ leading zeros - use compressed notation
        const zeroCount = match[1].length;
        const significantDigits = match[2].substring(0, 4); // Show first 4 significant digits

        // Convert zero count to subscript
        const subscriptCount = zeroCount
          .toString()
          .split('')
          .map((d) => MarketCapDatafeed.SUBSCRIPT_MAP[d] || d)
          .join('');

        return `${sign}${symbol}0.0${subscriptCount}${significantDigits}`;
      }

      // Less than 3 zeros - use standard decimal notation
      return `${sign}${symbol}${absValue.toFixed(8).replace(/\.?0+$/, '')}`;
    }

    // Standard formatting for values between 0.01 and 1000
    if (absValue >= 1) {
      return `${sign}${symbol}${absValue.toFixed(2)}`;
    } else if (absValue >= 0.01) {
      return `${sign}${symbol}${absValue.toFixed(4)}`;
    }

    return `${sign}${symbol}${absValue.toFixed(8)}`;
  }

  private tokenAddress: string;
  private displayCurrency: 'usd' | 'aces';
  private historyCache = new Map<string, Bar[]>();
  private lastHistoricalBarByTimeframe = new Map<string, Bar>();
  private mcapSubscription: McapDataSubscription | null = null;

  constructor(tokenAddress: string, displayCurrency: 'usd' | 'aces' = 'usd') {
    this.tokenAddress = tokenAddress.toLowerCase();
    this.displayCurrency = displayCurrency;
  }

  /**
   * Change display currency dynamically without recreating the datafeed
   */
  public setDisplayCurrency(currency: 'usd' | 'aces'): void {
    console.log(
      `[TradingView MCap] Switching display currency from ${this.displayCurrency} to ${currency}`,
    );
    this.displayCurrency = currency;
    this.historyCache.clear();
  }

  /**
   * Get current display currency
   */
  public getDisplayCurrency(): 'usd' | 'aces' {
    return this.displayCurrency;
  }

  searchSymbols() {
    // Not implemented
  }

  onReady(callback: OnReadyCallback) {
    setTimeout(() => {
      callback({
        supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
      });
    }, 0);
  }

  async resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: ResolveCallback,
    onResolveErrorCallback: (reason: string) => void,
  ) {
    try {
      const currencyLabel = this.displayCurrency.toUpperCase();

      // CRITICAL FIX: Use high precision for market cap to handle small values
      // Market cap for micro-cap tokens can be very small (e.g., $100.5678)
      // Using 10 decimals ensures proper display with subscript notation
      const precision = 10;
      const pricescale = 10000000000; // 10^10 for 10 decimals

      const normalizedSymbol = symbolName.includes('_MCAP_')
        ? symbolName
        : `${symbolName}_MCAP_${currencyLabel}`;

      const symbolInfo: LibrarySymbolInfo = {
        ticker: normalizedSymbol,
        name: `${symbolName.replace(/_MCAP_.+$/, '')} Market Cap`,
        description: `Market Cap (${currencyLabel})`,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'BondingCurve',
        minmov: 1,
        pricescale: pricescale,
        has_intraday: true,
        has_daily: true,
        supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
        volume_precision: 2,
        data_status: 'streaming',
        listed_exchange: 'BondingCurve',
        // Use 'price' format which includes leading zero (e.g., 0.000008 or 0.0₅8)
        format: 'price',
      };

      console.log('[MarketCapDatafeed] Symbol resolved with precision:', {
        precision,
        pricescale,
        currency: this.displayCurrency,
      });

      setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
    } catch (error) {
      onResolveErrorCallback('Failed to resolve market cap symbol');
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

    if (!periodParams.firstDataRequest && cachedBars) {
      const filtered = cachedBars.filter(
        (bar) => bar.time >= periodParams.from * 1000 && bar.time <= periodParams.to * 1000,
      );

      if (filtered.length > 0) {
        console.log('[MarketCapDatafeed] Sample cached market cap:', filtered[0].close);
      }

      onHistoryCallback(filtered, { noData: filtered.length === 0 });
      return;
    }

    this.fetchMarketCapData(timeframe, periodParams.from, periodParams.to)
      .then(({ bars }) => {
        if (bars.length === 0) {
          onHistoryCallback([], { noData: true });
          return;
        }

        // Cache the bars
        this.historyCache.set(timeframe, bars);

        // Track last bar for WebSocket subscriptions
        if (bars.length > 0) {
          this.lastHistoricalBarByTimeframe.set(timeframe, bars[bars.length - 1]);
          console.log('[MarketCapDatafeed] Sample market cap value:', bars[0].close);
        }

        onHistoryCallback(bars, { noData: false });
      })
      .catch((error) => {
        console.error('[MarketCapDatafeed] Error fetching bars:', error);
        onErrorCallback(error instanceof Error ? error.message : 'Failed to fetch market cap data');
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
      `[MarketCapDatafeed] Starting WebSocket subscription for ${this.tokenAddress} ${timeframe}`,
    );

    // Check if we already have an active subscription for this exact setup
    if (
      this.mcapSubscription &&
      this.mcapSubscription.tokenAddress === this.tokenAddress &&
      this.mcapSubscription.timeframe === timeframe &&
      this.mcapSubscription.isActive
    ) {
      console.log('[MarketCapDatafeed] ⚠️ Already subscribed, updating callbacks only');
      // Update callbacks without recreating WebSocket
      this.mcapSubscription.onRealtimeCallback = onRealtimeCallback;
      this.mcapSubscription.onResetCacheNeededCallback = onResetCacheNeededCallback;
      this.mcapSubscription.subscriberUID = subscriberUID;
      return;
    }

    // Close previous subscription only if it's for a different token/timeframe
    if (this.mcapSubscription) {
      console.log(
        '[MarketCapDatafeed] Closing previous subscription for different token/timeframe',
      );
      this.unsubscribeBars(this.mcapSubscription.subscriberUID);
    }

    const subscription: McapDataSubscription = {
      subscriberUID,
      tokenAddress: this.tokenAddress,
      timeframe,
      onRealtimeCallback,
      onResetCacheNeededCallback,
      isActive: true,
      lastBar: cloneBar(this.lastHistoricalBarByTimeframe.get(timeframe) || null),
      ws: null,
      reconnectTimeout: null,
    };

    this.mcapSubscription = subscription;
    this.startWebSocket();
  }

  unsubscribeBars(subscriberUID: string) {
    console.log(`[MarketCapDatafeed] 🔴 Unsubscribe requested for: ${subscriberUID}`);

    if (!this.mcapSubscription) {
      console.log('[MarketCapDatafeed] No active subscription to unsubscribe');
      return;
    }

    const subscription = this.mcapSubscription;
    if (subscription.subscriberUID !== subscriberUID) {
      console.log(
        `[MarketCapDatafeed] UID mismatch: expected ${subscription.subscriberUID}, got ${subscriberUID}`,
      );
      return;
    }

    console.log('[MarketCapDatafeed] ⚠️ Deactivating subscription and closing WebSocket');
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
            chartType: 'mcap',
          }),
        );
      }

      ws.close();
      subscription.ws = null;
    }

    this.mcapSubscription = null;
    console.log(`[MarketCapDatafeed] WebSocket unsubscribed successfully`);
  }

  private startWebSocket() {
    if (typeof window === 'undefined') {
      console.warn('[MarketCapDatafeed] WebSocket not started - window is undefined');
      return;
    }

    const subscription = this.mcapSubscription;

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
        console.log('[MarketCapDatafeed] WebSocket already connecting/connected');
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
        console.log('[MarketCapDatafeed] ✅ WebSocket connected for market cap updates');
        if (!subscription.isActive) {
          console.warn('[MarketCapDatafeed] ⚠️ Subscription inactive on open, closing...');
          ws.close();
          return;
        }

        const subscribeMessage = {
          type: 'subscribe',
          tokenAddress: subscription.tokenAddress,
          timeframe: subscription.timeframe,
          chartType: 'mcap',
        };
        console.log('[MarketCapDatafeed] 📤 Sending subscribe message:', subscribeMessage);
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        if (!subscription.isActive) {
          return;
        }

        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message, subscription);
        } catch (error) {
          console.error('[MarketCapDatafeed] WebSocket message error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[MarketCapDatafeed] WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('[MarketCapDatafeed] WebSocket closed, code:', event.code);

        if (!subscription.isActive) {
          return;
        }

        subscription.ws = null;
        subscription.reconnectTimeout = setTimeout(() => {
          console.log('[MarketCapDatafeed] Reconnecting WebSocket...');
          this.startWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('[MarketCapDatafeed] Failed to start WebSocket:', error);
    }
  }

  private handleWebSocketMessage(message: any, subscription: McapDataSubscription) {
    if (!message || typeof message !== 'object') {
      return;
    }

    // Check for graduation in ALL messages
    // When a token graduates from bonding curve to DEX, we need to refresh the chart
    if (message.graduationState) {
      const graduationState = message.graduationState;
      const justGraduated = graduationState.poolReady;

      if (justGraduated) {
        console.log('[MarketCapDatafeed] 🎓 Token graduated! Refreshing market cap data', {
          poolAddress: graduationState.poolAddress,
          dexLiveAt: graduationState.dexLiveAt,
          messageType: message.type,
        });

        // Clear caches and force refresh
        this.historyCache.clear();
        this.lastHistoricalBarByTimeframe.clear();

        try {
          subscription.onResetCacheNeededCallback();
          console.log('[MarketCapDatafeed] ✅ Initiated chart data refresh for graduation');
        } catch (error) {
          console.error('[MarketCapDatafeed] Error resetting cache on graduation:', error);
        }
      }
    }

    switch (message.type) {
      case 'graduation_event': {
        // Dedicated graduation event - already handled above
        console.log('[MarketCapDatafeed] Received graduation_event, cache reset already triggered');
        break;
      }

      case 'initial_data': {
        console.log(`[MarketCapDatafeed] Initial data: ${message.candles?.length || 0} candles`);
        // Don't overwrite HTTP data - just log for now
        break;
      }

      case 'candle_update': {
        const candle = message.candle as MarketCapCandle | undefined;
        if (!candle) {
          return;
        }

        const timeframeMs = this.timeframeToMs(subscription.timeframe);
        const baseBar = this.marketCapCandleToBar(candle, timeframeMs);

        if (!baseBar) {
          console.warn('[MarketCapDatafeed] Skipping invalid real-time candle:', candle);
          return;
        }

        // Determine if this is an update to the current candle or a new candle
        const isUpdateToCurrentCandle =
          subscription.lastBar && subscription.lastBar.time === baseBar.time;

        console.log(`[MarketCapDatafeed] 🔔 Real-time market cap update:`, {
          time: new Date(baseBar.time).toISOString(),
          isUpdate: isUpdateToCurrentCandle,
          marketCap: baseBar.close,
        });

        const bridgedBar = isUpdateToCurrentCandle
          ? baseBar
          : bridgeBar(subscription.lastBar, baseBar);

        const clonedBar = cloneBar(bridgedBar);
        subscription.lastBar = clonedBar;
        if (clonedBar) {
          this.lastHistoricalBarByTimeframe.set(subscription.timeframe, clonedBar);
        }

        try {
          subscription.onRealtimeCallback(bridgedBar);
          console.log('[MarketCapDatafeed] ✅ Real-time update applied');
        } catch (error) {
          console.error('[MarketCapDatafeed] Error calling onRealtimeCallback:', error);
        }

        this.updateHistoryCache(subscription.timeframe, bridgedBar);

        break;
      }

      case 'error': {
        console.error('[MarketCapDatafeed] WebSocket server error:', message.error);
        break;
      }

      default:
        break;
    }
  }

  private async fetchMarketCapData(
    timeframe: string,
    from: number,
    to: number,
  ): Promise<{ bars: Bar[] }> {
    const apiUrl = this.getApiUrl(
      `/api/v1/chart/${this.tokenAddress}/market-cap?timeframe=${timeframe}&from=${from}&to=${to}&currency=${this.displayCurrency}`,
    );

    console.log(`[MarketCapDatafeed] Fetching: ${apiUrl}`);

    const response = await window.fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data?.candles) {
      throw new Error('No market cap data available');
    }

    const candles: MarketCapCandle[] = data.data.candles;
    const timeframeMs = this.timeframeToMs(timeframe);

    const bars: Bar[] = candles
      .map((candle) => this.marketCapCandleToBar(candle, timeframeMs))
      .filter((bar: Bar | null): bar is Bar => bar !== null)
      .sort((a: Bar, b: Bar) => a.time - b.time);

    console.log(`[MarketCapDatafeed] Received ${bars.length} market cap bars`);

    // Debug logging
    if (bars.length === 0 && candles.length > 0) {
      console.warn(
        `[MarketCapDatafeed] ⚠️ No valid market cap data found. Received ${candles.length} candles but all had invalid values.`,
        'Sample candle:',
        candles[0],
      );
    } else if (bars.length > 0) {
      const firstBar = bars[0];
      const lastBar = bars[bars.length - 1];
      console.log(`[MarketCapDatafeed] ✅ Market cap OHLC data:`, {
        totalBars: bars.length,
        firstCandle: {
          open: firstBar.open,
          high: firstBar.high,
          low: firstBar.low,
          close: firstBar.close,
          hasBody: firstBar.open !== firstBar.close,
        },
        lastCandle: {
          open: lastBar.open,
          high: lastBar.high,
          low: lastBar.low,
          close: lastBar.close,
          hasBody: lastBar.open !== lastBar.close,
        },
        range: {
          minClose: Math.min(...bars.map((b) => b.close)),
          maxClose: Math.max(...bars.map((b) => b.close)),
        },
        candlesWithBodies: bars.filter((b) => b.open !== b.close).length,
      });
    }

    const filledBars = fillMissingBars(bars, timeframeMs);

    // 🌟 GENESIS CANDLE: Inject a "token birth" candle at market cap ~0 before first real candle
    const barsWithGenesis = this.injectGenesisCandleIfNeeded(filledBars, timeframeMs);

    return { bars: barsWithGenesis };
  }

  private marketCapCandleToBar(candle: MarketCapCandle, timeframeMs: number): Bar | null {
    if (!candle) {
      return null;
    }

    const parseValue = (value: number | string | null | undefined): number => {
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = parseFloat(value);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
      return NaN;
    };

    const parseWithFallback = (
      primary: number | string | null | undefined,
      ...fallbacks: Array<number | string | null | undefined>
    ): number => {
      const candidates = [primary, ...fallbacks];

      for (const candidate of candidates) {
        const parsed = parseValue(candidate);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }

      for (const candidate of candidates) {
        const parsed = parseValue(candidate);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }

      return NaN;
    };

    const preferredFallback =
      this.displayCurrency === 'aces' ? candle.marketCapAces : candle.marketCapUsd;

    const timestampMs = normaliseTimestamp(candle.timestamp ?? candle.time);

    if (!Number.isFinite(timestampMs)) {
      return null;
    }

    const alignedTime = alignTimeToTimeframe(timestampMs, timeframeMs);

    const fallbackValue = preferredFallback ?? candle.marketCap;

    const open = parseWithFallback(candle.open, fallbackValue);
    const high = parseWithFallback(candle.high, fallbackValue);
    const low = parseWithFallback(candle.low, fallbackValue);
    const close = parseWithFallback(candle.close, fallbackValue);
    const volumeParsed = parseValue(candle.volume ?? 0);

    const baseBar: Bar = {
      time: alignedTime,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volumeParsed) ? volumeParsed : 0,
    };

    return ensureValidOhlc(baseBar);
  }

  /**
   * Injects a synthetic "genesis candle" before the first real candle
   * This shows the token starting from ~$0 market cap before its first trade
   */
  private injectGenesisCandleIfNeeded(bars: Bar[], timeframeMs: number): Bar[] {
    if (bars.length === 0) {
      return bars;
    }

    const firstBar = bars[0];

    // Use an extremely small market cap to represent "starting from zero"
    // Not exactly 0 because logarithmic scale can't handle 0
    const genesisMarketCap = 0.0000000001; // 1e-10

    // Genesis candle is placed one timeframe before the first real candle
    const genesisTime = firstBar.time - timeframeMs;

    // Create the genesis candle
    const genesisCandle: Bar = {
      time: genesisTime,
      open: genesisMarketCap,
      high: Math.max(genesisMarketCap, firstBar.open), // High extends up to first trade
      low: genesisMarketCap,
      close: firstBar.open, // Close at first trade market cap (creates the jump visual)
      volume: 0, // No trades yet
    };

    console.log('🌟 [MarketCapDatafeed] Injecting genesis candle:', {
      genesisTime: new Date(genesisTime).toISOString(),
      genesisMarketCap: genesisMarketCap,
      firstRealMarketCap: firstBar.open,
      firstRealTime: new Date(firstBar.time).toISOString(),
    });

    // Prepend genesis candle to the beginning of the array
    return [genesisCandle, ...bars];
  }

  private updateHistoryCache(timeframe: string, bar: Bar) {
    if (!bar) {
      return;
    }

    const clonedBar: Bar = { ...bar };
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

    if (updated.length > MarketCapDatafeed.MAX_CACHED_BARS) {
      updated.splice(0, updated.length - MarketCapDatafeed.MAX_CACHED_BARS);
    }

    this.historyCache.set(timeframe, updated);
    this.lastHistoricalBarByTimeframe.set(timeframe, updated[updated.length - 1]);
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

  private getApiUrl(path: string): string {
    if (typeof window === 'undefined') {
      return path;
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiBaseUrl) {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      return `${apiBaseUrl}/${cleanPath}`;
    }

    return path;
  }
}
