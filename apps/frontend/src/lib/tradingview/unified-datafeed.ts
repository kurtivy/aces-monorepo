/**
 * Unified TradingView Datafeed
 *
 * Clean implementation that fetches data from the new unified backend endpoint.
 * This datafeed handles both price and market cap charts using a single data source.
 */

import {
  IBasicDataFeed,
  LibrarySymbolInfo,
  ResolutionString,
  Bar,
  HistoryCallback,
  DatafeedErrorCallback,
  PeriodParams,
  SubscribeBarsCallback,
  SearchSymbolsCallback,
  ResolveCallback,
  OnReadyCallback,
} from '../../../public/charting_library';
import { emitMarketCapUpdate } from './market-cap-events';
import { RealtimeCandleBuilder, type Trade } from './realtime-candle-builder';
import { sharedTradeWebSocket } from '../websocket/shared-trade-websocket';
// 🔥 PHASE 3: Connection health monitoring
import { connectionHealthMonitor } from '../websocket/connection-health-monitor';

interface UnifiedDatafeedConfig {
  apiBaseUrl: string;
  wsUrl?: string;
  debug?: boolean;
}

interface UnifiedCandle {
  timestamp: number; // Unix timestamp in seconds
  price: {
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
  };
  marketCap: {
    aces: string;
    usd: string;
    // Market cap OHLC (with smooth connections)
    marketCapOpenUsd?: string;
    marketCapHighUsd?: string;
    marketCapLowUsd?: string;
    marketCapCloseUsd?: string;
  };
  supply: {
    circulating: string;
    total: string;
  };
  trades: number;
  dataSource: 'bonding_curve' | 'dex';
}

interface UnifiedChartResponse {
  success: boolean;
  data: {
    candles: UnifiedCandle[];
    graduationState: {
      isBonded: boolean;
      poolAddress: string | null;
      poolReady: boolean;
      dexLiveAt: Date | null;
    };
    acesUsdPrice: string;
    metadata?: {
      timeframe: string;
      from: string;
      to: string;
      candleCount: number;
      hasRecentTrades?: boolean; // 🔥 NEW
      lastTradeTime?: string; // 🔥 NEW
      isRealTime?: boolean; // 🔥 NEW
    };
  };
}

interface SubscriptionInfo {
  symbolInfo: LibrarySymbolInfo;
  resolution: ResolutionString;
  onTick: SubscribeBarsCallback;
  listenerGuid: string;
  isMarketCapMode: boolean;
}

// 🔥 NEW: Cache entry for chart data
interface CacheEntry {
  data: UnifiedChartResponse;
  timestamp: number;
  bars: Bar[];
}

export class UnifiedDatafeed implements IBasicDataFeed {
  private config: UnifiedDatafeedConfig;
  private aggressivePollingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private lastUpdateCallbacks: Map<string, () => void> = new Map();
  private lastBars = new Map<string, Bar>();
  private subscriptions = new Map<string, SubscriptionInfo>();
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0; // Track reconnection attempts for exponential backoff
  private latestSupply = new Map<string, number>();
  private lastEmittedMarketCap = new Map<
    string,
    { marketCapUsd: number; currentPriceUsd?: number; timestamp: number }
  >();
  // 🔥 NEW: Client-side cache for chart data (keyed by tokenAddress:timeframe:mode)
  private chartDataCache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds - fresh enough for most use cases

  // 🔥 NEW: Real-time candle builder for converting trades to candles
  private candleBuilder: RealtimeCandleBuilder;
  // Track trade WebSocket connections per token
  private tradeWebSockets = new Map<string, () => void>();
  // Cache last known ACES/USD price for price reconstruction
  private lastKnownAcesUsd: number | null = null;
  // Track last known token USD price by token address for fallbacks
  private lastKnownTokenPrice = new Map<string, number>();
  // 🔥 NEW: Reference to TradingView widget for forcing realtime mode
  private tradingViewWidget: any = null;

  constructor(config: UnifiedDatafeedConfig) {
    this.config = {
      ...config,
      debug: config.debug ?? false,
    };

    this.candleBuilder = new RealtimeCandleBuilder(this.config.debug);

    if (this.config.debug) {
      // console.log('[UnifiedDatafeed] Initialized with config:', this.config);
    }

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Set the TradingView widget reference
   * This allows the datafeed to force realtime mode when new candles arrive
   */
  public setWidget(widget: any): void {
    this.tradingViewWidget = widget;
  }

  /**
   * Force the chart into realtime mode (auto-scroll to latest bar)
   */
  private forceRealtimeMode(): void {
    if (!this.tradingViewWidget) {
      if (this.config.debug) {
        console.warn('[UnifiedDatafeed] ⚠️ Cannot force realtime mode - no widget reference');
      }
      return;
    }

    try {
      // Get the active chart
      const getChart =
        typeof this.tradingViewWidget.activeChart === 'function'
          ? this.tradingViewWidget.activeChart
          : this.tradingViewWidget.chart;
      const chart = typeof getChart === 'function' ? getChart.call(this.tradingViewWidget) : null;

      if (!chart) {
        if (this.config.debug) {
          console.warn('[UnifiedDatafeed] ⚠️ Cannot force realtime mode - no chart instance');
        }
        return;
      }

      let methodSucceeded = false;

      // Try multiple methods to force realtime mode (don't give up on first error)

      // Method 1: executeActionById (standard approach)
      if (!methodSucceeded && typeof chart.executeActionById === 'function') {
        try {
          chart.executeActionById('chart_realtime');
          methodSucceeded = true;
        } catch (e) {
          if (this.config.debug) {
            console.warn(
              '[UnifiedDatafeed] Method 1 (executeActionById) failed, trying next method...',
            );
          }
        }
      }

      // Method 2: Try scrollToRealtime if available
      if (!methodSucceeded && typeof chart.scrollToRealtime === 'function') {
        try {
          chart.scrollToRealtime();
          methodSucceeded = true;
        } catch (e) {
          if (this.config.debug) {
            console.warn(
              '[UnifiedDatafeed] Method 2 (scrollToRealtime) failed, trying next method...',
            );
          }
        }
      }

      // Method 3: Try setVisibleRange to force scroll to latest
      if (!methodSucceeded && typeof chart.setVisibleRange === 'function') {
        try {
          const now = Date.now() / 1000;
          const oneHourAgo = now - 3600;
          chart.setVisibleRange({ from: oneHourAgo, to: now }, { percentRightMargin: 5 });
          methodSucceeded = true;
        } catch (e) {
          if (this.config.debug) {
            console.warn('[UnifiedDatafeed] Method 3 (setVisibleRange) failed:', e);
          }
        }
      }

      if (!methodSucceeded) {
        if (this.config.debug) {
          console.warn(
            '[UnifiedDatafeed] ⚠️ Could not force realtime mode - no working method available',
          );
        }
      }
    } catch (error) {
      console.error('[UnifiedDatafeed] ❌ Unexpected error in forceRealtimeMode:', error);
    }
  }

  /**
   * Clean up all connections and subscriptions
   * Call this when the component unmounts or when the datafeed is no longer needed
   */
  public destroy(): void {
    if (this.config.debug) {
      console.log('[UnifiedDatafeed] Destroying datafeed');
    }

    this.subscriptions.clear();
    this.cleanup();

    // 🔥 NEW: Unsubscribe from all trade WebSockets
    for (const [tokenAddress, unsubscribe] of this.tradeWebSockets.entries()) {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
        if (this.config.debug) {
          console.log('[UnifiedDatafeed] Unsubscribed from trade WebSocket for', tokenAddress);
        }
      }
    }
    this.tradeWebSockets.clear();

    // Clear candle builder
    this.candleBuilder.clear();

    // Clear widget reference
    this.tradingViewWidget = null;
  }

  // WebSocket connection management

  private connectWebSocket(): void {
    if (!this.config.wsUrl || this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    // console.log('[UnifiedDatafeed] 🔌 Connecting to WebSocket:', this.config.wsUrl);
    // console.log('[UnifiedDatafeed] 📊 Active subscriptions:', this.subscriptions.size);

    try {
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempt = 0; // Reset reconnection counter on success

        // Resubscribe to all existing subscriptions
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          this.handleWebSocketMessage(update);
        } catch (error) {
          console.error(
            '[UnifiedDatafeed] Error parsing WebSocket message:',
            error,
            'Raw data:',
            event.data,
          );
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.ws = null;

        // Auto-reconnect with exponential backoff if appropriate
        // Don't reconnect on normal closure (1000), going away (1001), or policy violation (1008)
        const shouldReconnect = event.code !== 1000 && event.code !== 1001 && event.code !== 1008;
        if (shouldReconnect) {
          const baseDelay = 1000;
          const maxDelay = 30000;
          const exponentialDelay = Math.min(
            baseDelay * Math.pow(2, this.reconnectAttempt),
            maxDelay,
          );
          const jitter = Math.random() * 1000;
          const delay = exponentialDelay + jitter;
          this.reconnectAttempt += 1;

          if (this.config.debug) {
            console.log(
              `[UnifiedDatafeed] WebSocket disconnected (code: ${event.code}), reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempt})...`,
            );
          }

          // Reconnect after exponential backoff delay
          this.reconnectTimeout = setTimeout(() => {
            this.connectWebSocket();
          }, delay);
        } else if (this.config.debug) {
          console.log(
            `[UnifiedDatafeed] WebSocket closed normally (code: ${event.code}), not reconnecting`,
          );
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;

        if (this.config.debug) {
          console.error('[UnifiedDatafeed] WebSocket error:', error);
        }
      };
    } catch (error) {
      this.isConnecting = false;

      if (this.config.debug) {
        console.error('[UnifiedDatafeed] Error creating WebSocket:', error);
      }
    }
  }

  private resubscribeAll(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // console.log('[UnifiedDatafeed] ⚠️ WebSocket not ready for resubscription');
      return;
    }

    // console.log('[UnifiedDatafeed] 🔄 Resubscribing to', this.subscriptions.size, 'subscriptions');

    for (const [subscriptionKey, subscriptionInfo] of this.subscriptions.entries()) {
      const rawTicker = subscriptionInfo.symbolInfo.ticker ?? '';
      // Clean token address: remove _MCAP suffix if present
      const tokenAddress = subscriptionInfo.isMarketCapMode
        ? rawTicker.replace(/_MCAP$/, '')
        : rawTicker;
      const timeframe = this.resolutionToTimeframe(subscriptionInfo.resolution);

      // console.log('[UnifiedDatafeed] 📝 Sending subscription:', {
      //   type: 'subscribe',
      //   cleanAddress: tokenAddress,
      //   timeframe,
      //   chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
      //   subscriptionKey,
      // });

      this.ws!.send(
        JSON.stringify({
          type: 'subscribe',
          tokenAddress, // Now clean address without _MCAP
          timeframe,
          chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
        }),
      );
    }
  }

  private handleWebSocketMessage(update: {
    type: string;
    tokenAddress?: string;
    timeframe?: string;
    chartType?: string;
    candle?: Record<string, unknown>;
    candles?: Array<{
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    graduationState?: {
      isBonded: boolean;
      poolReady: boolean;
      poolAddress: string | null;
      dexLiveAt: Date | null;
    };
  }): void {
    // 🔥 NEW: Handle graduation event - triggers full chart refresh
    if (update.type === 'graduation_event') {
      // console.log('[UnifiedDatafeed] 🎓 GRADUATION EVENT received:', {
      //   tokenAddress: update.tokenAddress,
      //   graduationState: update.graduationState,
      // });

      // Clear last bars to force a fresh fetch
      if (update.tokenAddress) {
        const tokenLower = update.tokenAddress.toLowerCase();

        // Clear cached bars for this token (both price and mcap)
        this.lastBars.delete(tokenLower);
        this.lastBars.delete(`${tokenLower}_MCAP`);

        // Clear supply cache
        this.latestSupply.delete(tokenLower);

        // 🔥 NEW: Clear chart data cache for this token (all timeframes)
        const cachesToClear: string[] = [];
        for (const cacheKey of this.chartDataCache.keys()) {
          if (cacheKey.startsWith(tokenLower + ':')) {
            cachesToClear.push(cacheKey);
          }
        }
        for (const cacheKey of cachesToClear) {
          this.chartDataCache.delete(cacheKey);
        }

        // console.log('[UnifiedDatafeed] 🔄 Cleared cached bars for graduated token');
        // console.log('[UnifiedDatafeed] 📊 Active subscriptions:', this.subscriptions.size);

        // Log all active subscriptions for this token
        for (const [key, sub] of this.subscriptions.entries()) {
          if (sub.symbolInfo.ticker?.toLowerCase().includes(tokenLower)) {
            console.log('[UnifiedDatafeed] 📌 Active subscription:', {
              key,
              ticker: sub.symbolInfo.ticker,
              resolution: sub.resolution,
              isMarketCap: sub.isMarketCapMode,
            });
          }
        }

        // Note: TradingView will automatically refetch data on the next update cycle
        // The WebSocket will continue sending candle_update events with the new DEX data
      }

      return;
    }

    if (update.type === 'candle_update') {
      // Find all subscriptions that match this update
      for (const [, subscriptionInfo] of this.subscriptions.entries()) {
        const tokenAddress = subscriptionInfo.symbolInfo.ticker ?? '';
        const timeframe = this.resolutionToTimeframe(subscriptionInfo.resolution);

        if (
          update.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase() &&
          update.timeframe === timeframe &&
          update.chartType === (subscriptionInfo.isMarketCapMode ? 'mcap' : 'price') &&
          update.candle
        ) {
          // console.log('[UnifiedDatafeed] ✅ Update matches subscription:', {
          //   updateToken: update.tokenAddress,
          //   subscriptionToken: tokenAddress,
          //   updateTimeframe: update.timeframe,
          //   subscriptionTimeframe: timeframe,
          //   updateChartType: update.chartType,
          //   subscriptionChartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
          // });
          const ticker = subscriptionInfo.symbolInfo.ticker ?? tokenAddress ?? '';
          const lastBar = this.lastBars.get(ticker);
          const rawTimestamp = update.candle.timestamp;
          const candleTime = typeof rawTimestamp === 'number' ? rawTimestamp : Number(rawTimestamp);

          if (!Number.isFinite(candleTime)) {
            if (this.config.debug) {
              console.warn('[UnifiedDatafeed] Ignoring update with invalid timestamp', {
                rawTimestamp,
              });
            }
            continue;
          }

          // Prevent time violations - critical for TradingView
          if (lastBar) {
            if (candleTime < lastBar.time) {
              if (this.config.debug) {
                console.warn('[UnifiedDatafeed] Skipping update - time regression', {
                  candleTime,
                  lastBarTime: lastBar.time,
                });
              }
              continue;
            }

            if (candleTime === lastBar.time) {
              const open = this.parseCandlePrice(
                update.candle,
                'open',
                subscriptionInfo.isMarketCapMode,
              );
              const high = this.parseCandlePrice(
                update.candle,
                'high',
                subscriptionInfo.isMarketCapMode,
              );
              const low = this.parseCandlePrice(
                update.candle,
                'low',
                subscriptionInfo.isMarketCapMode,
              );
              const close = this.parseCandlePrice(
                update.candle,
                'close',
                subscriptionInfo.isMarketCapMode,
              );
              const volume = parseFloat(String(update.candle.volume || '0'));

              const updatedBar: Bar = {
                time: lastBar.time,
                open: Number.isFinite(lastBar.open) ? lastBar.open : open,
                high,
                low,
                close,
                volume: Number.isFinite(volume) ? volume : 0,
              };

              // Validate the bar has valid numbers
              if (
                !Number.isFinite(updatedBar.open) ||
                !Number.isFinite(updatedBar.high) ||
                !Number.isFinite(updatedBar.low) ||
                !Number.isFinite(updatedBar.close)
              ) {
                console.error('[UnifiedDatafeed] ❌ Invalid updated bar data:', updatedBar);
                continue;
              }

              this.lastBars.set(ticker, updatedBar);

              // 🔥 NEW: Update cache with latest bar
              this.updateCacheWithNewBar(
                tokenAddress,
                timeframe,
                subscriptionInfo.isMarketCapMode,
                updatedBar,
              );

              // console.log('[UnifiedDatafeed] 📊 Calling onTick with updated bar:', {
              //   time: updatedBar.time,
              //   open: updatedBar.open,
              //   high: updatedBar.high,
              //   low: updatedBar.low,
              //   close: updatedBar.close,
              //   volume: updatedBar.volume,
              //   ticker,
              //   tokenAddress,
              //   timeframe,
              //   chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
              // });

              try {
                subscriptionInfo.onTick(updatedBar);
                // console.log('[UnifiedDatafeed] ✅ onTick called successfully');
              } catch (error) {
                console.error('[UnifiedDatafeed] ❌ Error calling onTick:', error);
              }

              if (!subscriptionInfo.isMarketCapMode) {
                this.handleMarketCapEmission(
                  tokenAddress,
                  update.candle,
                  updatedBar.close,
                  candleTime,
                );
              }

              if (this.config.debug) {
                // console.log('[UnifiedDatafeed] Updated existing bar via websocket:', updatedBar);
              }
              continue;
            }
          }

          const open = this.parseCandlePrice(
            update.candle,
            'open',
            subscriptionInfo.isMarketCapMode,
          );
          const high = this.parseCandlePrice(
            update.candle,
            'high',
            subscriptionInfo.isMarketCapMode,
          );
          const low = this.parseCandlePrice(update.candle, 'low', subscriptionInfo.isMarketCapMode);
          const close = this.parseCandlePrice(
            update.candle,
            'close',
            subscriptionInfo.isMarketCapMode,
          );
          const volume = parseFloat(String(update.candle.volume || '0'));

          const bar: Bar = {
            time: candleTime,
            open,
            high,
            low,
            close,
            volume: Number.isFinite(volume) ? volume : 0,
          };

          // Validate the bar has valid numbers
          if (
            !Number.isFinite(bar.open) ||
            !Number.isFinite(bar.high) ||
            !Number.isFinite(bar.low) ||
            !Number.isFinite(bar.close)
          ) {
            console.error('[UnifiedDatafeed] ❌ Invalid new bar data:', bar);
            continue;
          }

          this.lastBars.set(ticker, bar);

          // 🔥 NEW: Update cache with new bar
          this.updateCacheWithNewBar(
            tokenAddress,
            timeframe,
            subscriptionInfo.isMarketCapMode,
            bar,
          );

          // console.log('[UnifiedDatafeed] 📊 Calling onTick with new bar:', {
          //   time: bar.time,
          //   open: bar.open,
          //   high: bar.high,
          //   low: bar.low,
          //   close: bar.close,
          //   volume: bar.volume,
          //   ticker,
          //   tokenAddress,
          //   timeframe,
          //   chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
          // });

          try {
            subscriptionInfo.onTick(bar);
          } catch (error) {
            console.error('[UnifiedDatafeed] ❌ Error calling onTick for new bar:', error);
          }

          if (!subscriptionInfo.isMarketCapMode) {
            this.handleMarketCapEmission(tokenAddress, update.candle, bar.close, candleTime);
          }

          if (this.config.debug) {
            // console.log('[UnifiedDatafeed] Tick received:', bar);
          }
        }
      }
    } else if (update.type === 'initial_data') {
      // Handle initial data sent by the backend
      if (this.config.debug) {
        // console.log('[UnifiedDatafeed] Received initial data:', update.candles?.length, 'candles');
      }

      // Process initial candles if any
      if (update.candles && update.candles.length > 0) {
        const lastCandle = update.candles[update.candles.length - 1];
        if (lastCandle && update.tokenAddress) {
          // Convert and store the last bar
          const ticker = update.tokenAddress;
          const bar: Bar = {
            time: lastCandle.timestamp,
            open: lastCandle.open,
            high: lastCandle.high,
            low: lastCandle.low,
            close: lastCandle.close,
            volume: lastCandle.volume,
          };

          this.lastBars.set(ticker, bar);
        }
      }
    }
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnecting = false;
  }

  // Required TradingView methods

  onReady(callback: OnReadyCallback): void {
    if (this.config.debug) {
      console.log('[UnifiedDatafeed] onReady called - datafeed is initializing');
    }

    setTimeout(() => {
      const config = {
        supported_resolutions: ['1', '5', '15', '60', '240', '1D'] as ResolutionString[],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
      };

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] onReady completed with config:', config);
      }

      callback(config);
    }, 0);
  }

  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: SearchSymbolsCallback,
  ): void {
    if (this.config.debug) {
      // console.log('[UnifiedDatafeed] searchSymbols:', userInput);
    }
    // Not implementing search for now
    onResult([]);
  }

  resolveSymbol(
    symbolName: string,
    onResolve: ResolveCallback,
    _onError: DatafeedErrorCallback,
  ): void {
    if (this.config.debug) {
      console.log('[UnifiedDatafeed] resolveSymbol:', symbolName);
    }

    setTimeout(() => {
      const symbolInfo: LibrarySymbolInfo = {
        name: symbolName,
        ticker: symbolName,
        description: symbolName,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: '',
        minmov: 1,
        pricescale: 1000000000, // 9 decimals for micro-cap token precision (handles prices like $0.000305)
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: false,
        supported_resolutions: ['1', '5', '15', '60', '240', '1D'] as ResolutionString[],
        volume_precision: 2,
        data_status: 'streaming',
        format: 'price',
        listed_exchange: '',
      };

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] resolveSymbol resolved:', symbolInfo);
      }

      onResolve(symbolInfo);
    }, 0);
  }

  async getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: DatafeedErrorCallback,
  ): Promise<void> {
    // Parse symbol to extract token address and mode
    // Format: "0x123...abc" for price, "0x123...abc_MCAP" for market cap
    const symbol = symbolInfo.ticker ?? '';
    const isMarketCapMode = symbol.endsWith('_MCAP');
    const tokenAddress = isMarketCapMode ? symbol.replace('_MCAP', '') : symbol;
    const timeframe = this.resolutionToTimeframe(resolution);

    if (this.config.debug) {
      console.log('[UnifiedDatafeed] 📥 getBars called:', {
        symbol,
        token: tokenAddress,
        mode: isMarketCapMode ? 'mcap' : 'price',
        resolution,
        timeframe,
        from: new Date(periodParams.from * 1000).toISOString(),
        to: new Date(periodParams.to * 1000).toISOString(),
        firstDataRequest: periodParams.firstDataRequest,
        countBack: periodParams.countBack,
        isScrollingBack: !periodParams.firstDataRequest,
      });
    }

    // 🔥 CACHE DISABLED FOR DEBUGGING - Re-enable after progressive loading works
    // This ensures every scroll-back triggers a fresh API call so we can see what's happening

    try {
      // 🔥 UPDATED: Load more candles for lower timeframes + better scroll-back support
      const getInitialLimit = (tf: string) => {
        switch (tf) {
          case '1m':
            return 300; // 5 hours
          case '5m':
            return 240; // 20 hours
          case '15m':
            return 192; // 48 hours (2 days)
          case '1h':
            return 168; // 7 days
          case '4h':
            return 180; // 30 days
          case '1D':
            return 90; // 3 months
          default:
            return 150;
        }
      };

      const limit = periodParams.firstDataRequest
        ? getInitialLimit(timeframe)
        : periodParams.countBack || getInitialLimit(timeframe);

      // Build URL with time range and limit for better control
      const url = `${this.config.apiBaseUrl}/api/v1/chart/${tokenAddress}/unified?timeframe=${timeframe}&from=${periodParams.from}&to=${periodParams.to}&limit=${limit}`;

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] 🔥 Fetching candles:', {
          type: periodParams.firstDataRequest ? '📊 INITIAL LOAD' : '📜 SCROLL BACK',
          timeframe,
          limit,
          countBack: periodParams.countBack,
          timeRange: {
            from: new Date(periodParams.from * 1000).toISOString(),
            to: new Date(periodParams.to * 1000).toISOString(),
            durationHours: Math.round((periodParams.to - periodParams.from) / 3600),
          },
          url,
        });
      }

      const response = await fetch(url);
      const result: UnifiedChartResponse = await response.json();

      // 🔥 REAL-TIME ENHANCEMENT: Check if we need to start aggressive polling
      if (result.success && result.data?.metadata?.isRealTime) {
        this.startAggressivePolling(tokenAddress, result.data.metadata.lastTradeTime);
      }

      if (!result.success) {
        throw new Error('Failed to fetch chart data');
      }

      const { candles } = result.data;

      const fetchedAcesUsd = Number.parseFloat(result.data?.acesUsdPrice ?? '0');
      if (Number.isFinite(fetchedAcesUsd) && fetchedAcesUsd > 0) {
        this.lastKnownAcesUsd = fetchedAcesUsd;
      }

      if (!candles || candles.length === 0) {
        if (this.config.debug) {
          // console.log('[UnifiedDatafeed] No candles returned');
        }
        onResult([], { noData: true });
        return;
      }

      // Filter candles to requested time range
      const filteredCandles = candles.filter(
        (c) => c.timestamp >= periodParams.from && c.timestamp <= periodParams.to,
      );

      if (filteredCandles.length === 0) {
        if (this.config.debug) {
          // console.log('[UnifiedDatafeed] No candles in requested range');
        }
        onResult([], { noData: true });
        return;
      }

      // Convert to TradingView Bar format
      const bars: Bar[] = filteredCandles.map((candle) => {
        if (candle.supply?.circulating) {
          const supplyValue = parseFloat(candle.supply.circulating);
          if (Number.isFinite(supplyValue) && supplyValue > 0) {
            this.latestSupply.set(tokenAddress.toLowerCase(), supplyValue);
          }
        }

        if (isMarketCapMode) {
          // Market cap mode: Use pre-calculated market cap OHLC (with smooth connections!)
          const marketCapOpenUsd = parseFloat(candle.marketCap.marketCapOpenUsd || '0');
          const marketCapHighUsd = parseFloat(candle.marketCap.marketCapHighUsd || '0');
          const marketCapLowUsd = parseFloat(candle.marketCap.marketCapLowUsd || '0');
          const marketCapCloseUsd = parseFloat(candle.marketCap.marketCapCloseUsd || '0');

          return {
            time: candle.timestamp * 1000,
            open: marketCapOpenUsd,
            high: marketCapHighUsd,
            low: marketCapLowUsd,
            close: marketCapCloseUsd,
            volume: parseFloat(candle.price.volume),
          };
        } else {
          // Price mode: use USD prices
          return {
            time: candle.timestamp * 1000,
            open: parseFloat(candle.price.openUsd),
            high: parseFloat(candle.price.highUsd),
            low: parseFloat(candle.price.lowUsd),
            close: parseFloat(candle.price.closeUsd),
            volume: parseFloat(candle.price.volume),
          };
        }
      });

      // Store last bar for WebSocket updates
      if (bars.length > 0 && symbolInfo.ticker) {
        const lastBar = bars[bars.length - 1];

        // 🔥 CRITICAL FIX: Only update lastBars if this bar is NEWER than existing
        // This prevents scroll-back historical data from overwriting the most recent bar
        const currentLastBar = this.lastBars.get(symbolInfo.ticker);
        if (!currentLastBar || lastBar.time >= currentLastBar.time) {
          this.lastBars.set(symbolInfo.ticker, lastBar);

          const normalizedAddress = tokenAddress.toLowerCase();
          if (Number.isFinite(lastBar.close) && (lastBar.close ?? 0) > 0) {
            this.lastKnownTokenPrice.set(normalizedAddress, lastBar.close ?? 0);
          }

          // 🔥 NEW: Seed candle builder with the latest candle
          // This ensures continuity between REST API data and WebSocket updates
          this.candleBuilder.seedCandle(timeframe, {
            time: lastBar.time,
            open: lastBar.open,
            high: lastBar.high,
            low: lastBar.low,
            close: lastBar.close,
            volume: lastBar.volume ?? 0,
          });
        }
      }

      // 🔥 CACHING DISABLED FOR DEBUGGING
      // if (bars.length > 0) {
      //   this.chartDataCache.set(cacheKey, {
      //     data: result,
      //     timestamp: now,
      //     bars: bars,
      //   });

      //   if (this.config.debug) {
      //     console.log('[UnifiedDatafeed] 💾 Cached data for:', cacheKey, `(${bars.length} bars)`);
      //   }
      // }

      // Emit latest market cap update for downstream consumers
      const lastCandle = filteredCandles[filteredCandles.length - 1];
      if (lastCandle) {
        const closePriceUsd = parseFloat(lastCandle.price?.closeUsd || '0');
        const supplyValue = parseFloat(
          lastCandle.supply?.circulating || lastCandle.supply?.total || '0',
        );
        const marketCapCloseUsd = parseFloat(
          lastCandle.marketCap.marketCapCloseUsd || lastCandle.marketCap.usd || '0',
        );

        if (
          Number.isFinite(marketCapCloseUsd) &&
          marketCapCloseUsd > 0 &&
          Number.isFinite(supplyValue) &&
          supplyValue > 0
        ) {
          const normalizedAddress = tokenAddress.toLowerCase();
          this.latestSupply.set(normalizedAddress, supplyValue);
          if (Number.isFinite(closePriceUsd) && closePriceUsd > 0) {
            this.lastKnownTokenPrice.set(normalizedAddress, closePriceUsd);
          }
          this.emitMarketCapIfChanged(
            tokenAddress,
            marketCapCloseUsd,
            Number.isFinite(closePriceUsd) && closePriceUsd > 0 ? closePriceUsd : undefined,
            Number.isFinite(supplyValue) && supplyValue > 0 ? supplyValue : undefined,
            lastCandle.timestamp * 1000,
            isMarketCapMode ? 'mcap' : 'price',
          );
        }
      }

      // 🔥 DEBUG LOGGING - Find specific candles to diagnose the issue
      // console.log('[UnifiedDatafeed] 📊 getBars returning:', {
      //   tokenAddress,
      //   from: new Date(periodParams.from * 1000).toISOString(),
      //   to: new Date(periodParams.to * 1000).toISOString(),
      //   totalBars: bars.length,
      //   firstBar: bars[0]
      //     ? {
      //         time: new Date(bars[0].time).toISOString(),
      //         volume: bars[0].volume,
      //         close: bars[0].close,
      //       }
      //     : null,
      //   lastBar: bars[bars.length - 1]
      //     ? {
      //         time: new Date(bars[bars.length - 1].time).toISOString(),
      //         volume: bars[bars.length - 1].volume,
      //         close: bars[bars.length - 1].close,
      //       }
      //     : null,
      //   // Find candles around the trade time (05:15-05:20)
      //   candlesAround0515: bars
      //     .filter((b) => {
      //       const time = new Date(b.time);
      //       const hour = time.getUTCHours();
      //       const minute = time.getUTCMinutes();
      //       // Look for 05:00 to 05:30 range
      //       return hour === 5 && minute >= 0 && minute <= 30;
      //     })
      //     .map((b) => ({
      //       time: new Date(b.time).toISOString(),
      //       volume: b.volume,
      //       close: b.close,
      //       trades: filteredCandles.find((c) => c.timestamp * 1000 === b.time)?.trades || 0,
      //     })),
      // });

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] ✅ Returning bars:', {
          count: bars.length,
          firstBar: bars[0]
            ? {
                time: new Date(bars[0].time).toISOString(),
                close: bars[0].close,
              }
            : null,
          lastBar: bars[bars.length - 1]
            ? {
                time: new Date(bars[bars.length - 1].time).toISOString(),
                close: bars[bars.length - 1].close,
              }
            : null,
        });
      }

      // 🔥 CRITICAL: Tell TradingView if there's more data available
      // nextTime should point to BEFORE the first bar (indicating more history exists)
      const noData = bars.length === 0;
      const nextTime = bars.length > 0 ? bars[0].time / 1000 : undefined;

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] 📤 Response metadata:', {
          noData,
          nextTime: nextTime ? new Date(nextTime * 1000).toISOString() : 'none',
          hasMoreData: !noData && nextTime !== undefined,
          message: noData
            ? '⚠️ No data - scroll back disabled'
            : nextTime
              ? '✅ More data available - scroll back enabled'
              : '⚠️ No nextTime - scroll back might fail',
        });
      }

      onResult(bars, {
        noData,
        nextTime, // Tells TradingView there's more data before this time
      });
    } catch (error) {
      console.error('[UnifiedDatafeed] Error fetching bars:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError(errorMessage);
    }
  }

  /**
   * 🔥 NEW: Connect to trade WebSocket for real-time candle updates using shared manager
   */
  private connectTradeWebSocket(
    tokenAddress: string,
    _timeframe: string,
    _onTick: SubscribeBarsCallback,
  ): void {
    // Check if we're already subscribed for this token
    if (this.tradeWebSockets.has(tokenAddress)) {
      return;
    }

    if (this.config.debug) {
      console.log('[UnifiedDatafeed] 🔌 Subscribing to shared trade WebSocket for:', tokenAddress);
    }

    // Subscribe to shared WebSocket manager
    const unsubscribe = sharedTradeWebSocket.subscribe(
      tokenAddress,
      // Trade callback
      (trade) => {
        const normalizedAddress = tokenAddress.toLowerCase();
        const directPriceUsd = Number.parseFloat(trade.priceUsd);
        const pricePerTokenAces = Number.parseFloat(trade.pricePerToken);
        const tokenAmount = Number.parseFloat(trade.tokenAmount);
        const acesAmount = Number.parseFloat(trade.acesAmount);

        let resolvedPriceUsd =
          Number.isFinite(directPriceUsd) && directPriceUsd > 0 ? directPriceUsd : null;

        if (
          !resolvedPriceUsd &&
          Number.isFinite(pricePerTokenAces) &&
          pricePerTokenAces > 0 &&
          this.lastKnownAcesUsd &&
          this.lastKnownAcesUsd > 0
        ) {
          resolvedPriceUsd = pricePerTokenAces * this.lastKnownAcesUsd;
        }

        if (
          !resolvedPriceUsd &&
          Number.isFinite(tokenAmount) &&
          tokenAmount > 0 &&
          Number.isFinite(acesAmount) &&
          acesAmount > 0 &&
          this.lastKnownAcesUsd &&
          this.lastKnownAcesUsd > 0
        ) {
          resolvedPriceUsd = (acesAmount / tokenAmount) * this.lastKnownAcesUsd;
        }

        if (!resolvedPriceUsd) {
          const priorClose = this.lastKnownTokenPrice.get(normalizedAddress);
          if (typeof priorClose === 'number' && priorClose > 0) {
            resolvedPriceUsd = priorClose;
          }
        }

        if (!resolvedPriceUsd) {
          if (this.config.debug) {
            console.warn('[UnifiedDatafeed] ⚠️ Skipping trade with missing USD price', {
              tradeId: trade.id,
              source: trade.source,
            });
          }
          return;
        }

        const volumeTokens = Number.isFinite(tokenAmount) && tokenAmount > 0 ? tokenAmount : 0;

        // 🔥 DEBUG: Check timestamp format (behind debug flag)
        const now = Date.now();
        if (this.config.debug) {
          console.log('[UnifiedDatafeed] 🔍 Trade timestamp check:', {
            rawTimestamp: trade.timestamp,
            rawTimestampISO: new Date(trade.timestamp).toISOString(),
            currentTime: now,
            currentTimeISO: new Date(now).toISOString(),
            timeDiffMs: now - trade.timestamp,
            timeDiffSeconds: Math.round((now - trade.timestamp) / 1000),
            // Check if timestamp looks like seconds instead of milliseconds
            looksLikeSeconds: trade.timestamp < 100000000000, // Before year 5138
            looksLikeMilliseconds: trade.timestamp > 100000000000,
          });
        }

        // Convert to Trade format for candle builder
        const tradeData: Trade = {
          timestamp: trade.timestamp,
          price: resolvedPriceUsd,
          volume: volumeTokens,
          isBuy: trade.isBuy,
        };

        this.lastKnownTokenPrice.set(normalizedAddress, resolvedPriceUsd);

        // 🔥 DEBUG: Monitor trade timing to diagnose time violations
        const tradeAge = now - trade.timestamp;
        if (tradeAge > 60000) {
          // Trade is more than 1 minute old - log warning
          console.warn('[UnifiedDatafeed] ⚠️ Old trade received:', {
            ageSeconds: Math.round(tradeAge / 1000),
            source: trade.source,
          });
        }

        // Process trade through candle builder
        this.candleBuilder.processTrade(tradeData);

        if (this.config.debug) {
          console.log('[UnifiedDatafeed] 📊 Trade processed:', {
            price: tradeData.price,
            volume: tradeData.volume,
            source: trade.source,
            ageMs: tradeAge,
          });
        }
      },
      // Status callback
      (status) => {
        if (this.config.debug) {
          console.log('[UnifiedDatafeed] Trade WebSocket status:', status);
        }
      },
    );

    // Store unsubscribe function instead of WebSocket
    this.tradeWebSockets.set(tokenAddress, unsubscribe);
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
    _onResetCacheNeededCallback: () => void,
  ): void {
    const rawTicker = symbolInfo.ticker || '';
    const isMarketCapMode = Boolean(rawTicker.endsWith('_MCAP'));

    // Clean token address: remove _MCAP suffix if present
    const tokenAddress = isMarketCapMode ? rawTicker.replace(/_MCAP$/, '') : rawTicker;

    const timeframe = this.resolutionToTimeframe(resolution);
    const subscriptionKey = `${rawTicker}:${timeframe}:${listenerGuid}`;

    if (this.config.debug) {
      console.log('[UnifiedDatafeed] subscribeBars:', {
        subscriptionKey,
        cleanAddress: tokenAddress,
        chartType: isMarketCapMode ? 'mcap' : 'price',
        timeframe,
      });
    }

    // Store subscription info
    this.subscriptions.set(subscriptionKey, {
      symbolInfo,
      resolution,
      onTick,
      listenerGuid,
      isMarketCapMode,
    });

    const normalizedTokenAddress = tokenAddress.toLowerCase();

    // 🔥 NEW: Subscribe to candle builder updates
    const unsubscribe = this.candleBuilder.subscribe(timeframe, (candle) => {
      // Convert candle to TradingView Bar format
      // Candle time is in milliseconds, TradingView expects milliseconds
      const bar: Bar = {
        time: candle.time as Bar['time'], // TradingView expects milliseconds
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      };

      // Get the previous last bar to compare
      const previousLastBar = this.lastBars.get(rawTicker);

      // Update last bar
      this.lastBars.set(rawTicker, bar);

      if (!isMarketCapMode && Number.isFinite(bar.close) && bar.close > 0) {
        this.lastKnownTokenPrice.set(normalizedTokenAddress, bar.close);
      }

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] 🔔 Candle builder callback fired:', {
          timeframe,
          candleTime: new Date(candle.time).toISOString(),
          barTime: bar.time,
          barTimeISO: new Date(bar.time as number).toISOString(),
          close: bar.close,
          volume: bar.volume,
          previousLastBarTime: previousLastBar
            ? new Date(previousLastBar.time as number).toISOString()
            : 'none',
          isUpdate: previousLastBar?.time === bar.time,
          isNewCandle: previousLastBar && previousLastBar.time !== bar.time,
        });
      }

      // Detect if this is a new candle (different time) vs update to existing candle
      const isNewCandle = previousLastBar && previousLastBar.time !== bar.time;

      // Call TradingView's onTick callback
      // TradingView handles both:
      // 1. Updating existing candle if bar.time matches last bar.time
      // 2. Adding new candle if bar.time is after last bar.time
      try {
        onTick(bar);

        // 🔥 CRITICAL FIX: Force chart into realtime mode when new candle arrives
        // This prevents the chart from getting stuck showing old candles
        if (isNewCandle) {
          this.forceRealtimeMode();
        }
      } catch (error) {
        console.error('[UnifiedDatafeed] ❌ Error calling onTick:', error);
      }
    });

    // Store unsubscribe function for cleanup
    (this.subscriptions.get(subscriptionKey) as any).unsubscribe = unsubscribe;

    // 🔥 NEW: Connect to trade WebSocket to receive real-time trades
    this.connectTradeWebSocket(tokenAddress, timeframe, onTick);

    // 🔥 PHASE 3: Start health monitoring for diagnostics
    connectionHealthMonitor.startMonitoring(tokenAddress, true);
  }

  unsubscribeBars(listenerGuid: string): void {
    if (this.config.debug) {
      console.log('[UnifiedDatafeed] unsubscribeBars:', listenerGuid);
    }

    // Find and remove subscriptions for this listener
    const subscriptionsToRemove: string[] = [];

    for (const [subscriptionKey, subscriptionInfo] of this.subscriptions.entries()) {
      if (subscriptionKey.endsWith(`:${listenerGuid}`)) {
        subscriptionsToRemove.push(subscriptionKey);

        // 🔥 NEW: Unsubscribe from candle builder
        const unsubscribe = (subscriptionInfo as any).unsubscribe;
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }

        // If WebSocket is open, send unsubscribe message
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const rawTicker = subscriptionInfo.symbolInfo.ticker ?? '';
          // Clean token address: remove _MCAP suffix if present
          const tokenAddress = subscriptionInfo.isMarketCapMode
            ? rawTicker.replace(/_MCAP$/, '')
            : rawTicker;
          const timeframe = this.resolutionToTimeframe(subscriptionInfo.resolution);

          if (this.config.debug) {
            console.log('[UnifiedDatafeed] Unsubscribing from:', {
              subscriptionKey,
              cleanAddress: tokenAddress,
              chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
            });
          }

          this.ws.send(
            JSON.stringify({
              type: 'unsubscribe',
              tokenAddress, // Now clean address without _MCAP
              timeframe,
              chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
            }),
          );
        }
      }
    }

    // Remove subscriptions from our map
    for (const key of subscriptionsToRemove) {
      this.subscriptions.delete(key);
    }

    // If no subscriptions left, cleanup
    if (this.subscriptions.size === 0) {
      if (this.config.debug) {
        console.log('[UnifiedDatafeed] No more subscriptions, cleaning up');
      }
      this.cleanup();
      // 🔥 PHASE 3: Stop health monitoring
      for (const [tokenAddress] of this.tradeWebSockets.entries()) {
        connectionHealthMonitor.stopMonitoring(tokenAddress);
      }
      // Unsubscribe from trade WebSockets
      for (const [tokenAddress, unsubscribe] of this.tradeWebSockets.entries()) {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
        this.tradeWebSockets.delete(tokenAddress);
      }
      // Clear candle builder
      this.candleBuilder.clear();
    }
  }

  // Helper methods

  private parseCandlePrice(
    candle: Record<string, unknown>,
    field: 'open' | 'high' | 'low' | 'close',
    isMarketCapMode: boolean,
  ): number {
    if (!isMarketCapMode) {
      const usdKey = `${field}Usd`;
      const usdValue = candle[usdKey];
      const parsedUsd =
        typeof usdValue === 'string' ? parseFloat(usdValue) : Number(usdValue ?? NaN);
      if (Number.isFinite(parsedUsd) && parsedUsd > 0) {
        return parsedUsd;
      }
    }

    const rawValue = candle[field];
    const parsed = typeof rawValue === 'string' ? parseFloat(rawValue) : Number(rawValue ?? NaN);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return 0;
  }

  private handleMarketCapEmission(
    tokenAddress: string | null | undefined,
    candle: Record<string, unknown>,
    lastClose: number,
    candleTime: number,
  ) {
    if (!tokenAddress) return;

    const normalizedToken = tokenAddress.toLowerCase();
    const supplyValue = this.latestSupply.get(normalizedToken);
    const closePriceUsd =
      typeof candle?.closeUsd === 'string'
        ? parseFloat(candle.closeUsd)
        : Number(candle?.closeUsd ?? 0);

    if (
      Number.isFinite(closePriceUsd) &&
      closePriceUsd > 0 &&
      Number.isFinite(supplyValue) &&
      supplyValue !== undefined &&
      supplyValue > 0
    ) {
      this.emitMarketCapIfChanged(
        normalizedToken,
        closePriceUsd * supplyValue,
        closePriceUsd,
        supplyValue,
        candleTime,
        'price',
      );
    } else if (
      Number.isFinite(lastClose) &&
      lastClose > 0 &&
      Number.isFinite(supplyValue) &&
      supplyValue !== undefined &&
      supplyValue > 0
    ) {
      this.emitMarketCapIfChanged(
        normalizedToken,
        lastClose * supplyValue,
        lastClose,
        supplyValue,
        candleTime,
        'price',
      );
    }
  }

  private resolutionToTimeframe(resolution: ResolutionString): string {
    const map: Record<string, string> = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '60': '1h',
      '240': '4h',
      '1D': '1d',
      D: '1d',
    };

    return map[resolution] || '1h';
  }

  private emitMarketCapIfChanged(
    tokenAddress: string,
    marketCapUsd: number,
    currentPriceUsd?: number,
    circulatingSupply?: number,
    timestamp?: number,
    source: 'price' | 'mcap' = 'price',
  ): void {
    if (!Number.isFinite(marketCapUsd) || marketCapUsd <= 0) {
      return;
    }

    const normalized = tokenAddress.toLowerCase();
    const now = Date.now();
    const last = this.lastEmittedMarketCap.get(normalized);

    const priceVal =
      currentPriceUsd !== undefined && Number.isFinite(currentPriceUsd) && currentPriceUsd > 0
        ? currentPriceUsd
        : undefined;

    const minIntervalMs = 1000;
    const deltaThresholdRatio = 0.001; // 0.1%

    const shouldEmit =
      !last ||
      now - last.timestamp >= minIntervalMs ||
      Math.abs(marketCapUsd - last.marketCapUsd) / last.marketCapUsd >= deltaThresholdRatio ||
      (priceVal !== undefined &&
        last.currentPriceUsd !== undefined &&
        Math.abs(priceVal - last.currentPriceUsd) / last.currentPriceUsd >= deltaThresholdRatio);

    if (!shouldEmit) {
      return;
    }

    this.lastEmittedMarketCap.set(normalized, {
      marketCapUsd,
      currentPriceUsd: priceVal,
      timestamp: now,
    });

    emitMarketCapUpdate({
      tokenAddress: normalized,
      marketCapUsd,
      currentPriceUsd: priceVal,
      circulatingSupply,
      timestamp: timestamp ?? now,
      source,
    });
  }

  /**
   * 🔥 NEW: Update cache with real-time bar updates
   * This ensures cached data stays fresh when switching timeframes
   */
  private updateCacheWithNewBar(
    tokenAddress: string,
    timeframe: string,
    isMarketCapMode: boolean,
    newBar: Bar,
  ): void {
    const cacheKey = `${tokenAddress.toLowerCase()}:${timeframe}:${isMarketCapMode ? 'mcap' : 'price'}`;
    const cached = this.chartDataCache.get(cacheKey);

    if (!cached) {
      // No cache to update
      return;
    }

    // Find if this bar already exists in cache
    const existingBarIndex = cached.bars.findIndex((bar) => bar.time === newBar.time);

    if (existingBarIndex >= 0) {
      // Update existing bar
      cached.bars[existingBarIndex] = newBar;
      if (this.config.debug) {
        // console.log('[UnifiedDatafeed] 💾 Updated cached bar:', {
        //   cacheKey,
        //   barTime: new Date(newBar.time).toISOString(),
        // });
      }
    } else {
      // Append new bar to cache
      cached.bars.push(newBar);
      // Keep cache sorted by time
      cached.bars.sort((a, b) => a.time - b.time);
      if (this.config.debug) {
        // console.log('[UnifiedDatafeed] 💾 Added new bar to cache:', {
        //   cacheKey,
        //   barTime: new Date(newBar.time).toISOString(),
        //   totalBars: cached.bars.length,
        // });
      }
    }

    // Keep cache timestamp fresh so it doesn't expire during active trading
    cached.timestamp = Date.now();
  }

  /**
   * 🔥 REAL-TIME ENHANCEMENT: Start aggressive polling for active trading
   */
  private startAggressivePolling(tokenAddress: string, _lastTradeTime?: string): void {
    const key = tokenAddress;

    // Clear existing interval if any
    if (this.aggressivePollingIntervals.has(key)) {
      clearInterval(this.aggressivePollingIntervals.get(key)!);
    }

    if (this.config.debug) {
      // console.log('[UnifiedDatafeed] 🔥 Starting aggressive polling for', tokenAddress);
    }

    // Poll every 1-2 seconds during active trading
    const interval = setInterval(async () => {
      try {
        // Get the current subscription for this token
        const subscription = Array.from(this.subscriptions.values()).find(
          (sub) => sub.symbolInfo.ticker === tokenAddress,
        );

        if (!subscription) {
          this.stopAggressivePolling(tokenAddress);
          return;
        }

        // Fetch latest candle data
        const now = Math.floor(Date.now() / 1000);
        const oneHourAgo = now - 3600; // Last hour

        const url = `${this.config.apiBaseUrl}/api/v1/chart/${tokenAddress}/unified?timeframe=1m&from=${oneHourAgo}&to=${now}&limit=60`;
        const response = await fetch(url);
        const result: UnifiedChartResponse = await response.json();

        if (result.success && result.data?.candles?.length > 0) {
          const latestCandle = result.data.candles[result.data.candles.length - 1];

          // Convert to TradingView bar format
          const bar: Bar = {
            time: latestCandle.timestamp * 1000, // TradingView expects milliseconds
            open: parseFloat(latestCandle.price.open),
            high: parseFloat(latestCandle.price.high),
            low: parseFloat(latestCandle.price.low),
            close: parseFloat(latestCandle.price.close),
            volume: parseFloat(latestCandle.price.volume),
          };

          // Check if this is a new/updated candle
          const lastBar = this.lastBars.get(key);
          if (
            !lastBar ||
            lastBar.time !== bar.time ||
            lastBar.close !== bar.close ||
            lastBar.volume !== bar.volume
          ) {
            // Update the chart with new data
            subscription.onTick(bar);
            this.lastBars.set(key, bar);

            // 🔥 NEW: Update cache with polling data
            const timeframe = this.resolutionToTimeframe(subscription.resolution);
            this.updateCacheWithNewBar(tokenAddress, timeframe, subscription.isMarketCapMode, bar);

            if (this.config.debug) {
              // console.log('[UnifiedDatafeed] 🔥 Real-time update:', bar);
            }
          }

          // If no recent trades, slow down polling
          const isStillActive = result.data.metadata?.isRealTime;
          if (!isStillActive) {
            this.stopAggressivePolling(tokenAddress);
          }
        }
      } catch (error) {
        console.error('[UnifiedDatafeed] Aggressive polling error:', error);
      }
    }, 1500); // 1.5 second intervals

    this.aggressivePollingIntervals.set(key, interval);

    // Auto-stop after 5 minutes of aggressive polling
    setTimeout(
      () => {
        this.stopAggressivePolling(tokenAddress);
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Stop aggressive polling for a token
   */
  private stopAggressivePolling(tokenAddress: string): void {
    const key = tokenAddress;
    const interval = this.aggressivePollingIntervals.get(key);

    if (interval) {
      clearInterval(interval);
      this.aggressivePollingIntervals.delete(key);

      if (this.config.debug) {
        // console.log('[UnifiedDatafeed] 🔥 Stopped aggressive polling for', tokenAddress);
      }
    }
  }
}
