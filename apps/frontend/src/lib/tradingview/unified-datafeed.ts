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

export class UnifiedDatafeed implements IBasicDataFeed {
  private config: UnifiedDatafeedConfig;
  private aggressivePollingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private lastUpdateCallbacks: Map<string, () => void> = new Map();
  private lastBars = new Map<string, Bar>();
  private subscriptions = new Map<string, SubscriptionInfo>();
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private latestSupply = new Map<string, number>();
  private lastEmittedMarketCap = new Map<
    string,
    { marketCapUsd: number; currentPriceUsd?: number; timestamp: number }
  >();

  constructor(config: UnifiedDatafeedConfig) {
    this.config = {
      ...config,
      debug: config.debug ?? false,
    };

    if (this.config.debug) {
      console.log('[UnifiedDatafeed] Initialized with config:', this.config);
    }

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
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
  }

  // WebSocket connection management

  private connectWebSocket(): void {
    if (!this.config.wsUrl || this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    console.log('[UnifiedDatafeed] 🔌 Connecting to WebSocket:', this.config.wsUrl);
    console.log('[UnifiedDatafeed] 📊 Active subscriptions:', this.subscriptions.size);

    try {
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;

        console.log('[UnifiedDatafeed] ✅ WebSocket connected successfully');
        console.log(
          '[UnifiedDatafeed] 🔄 Resubscribing to',
          this.subscriptions.size,
          'subscriptions',
        );

        // Resubscribe to all existing subscriptions
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          console.log('[UnifiedDatafeed] 📨 Received WebSocket message:', {
            type: update.type,
            tokenAddress: update.tokenAddress,
            timeframe: update.timeframe,
            chartType: update.chartType,
            hasCandle: !!update.candle,
            dataSource: update.candle?.dataSource,
            candleTimestamp: update.candle?.timestamp
              ? new Date(update.candle.timestamp).toISOString()
              : null,
          });
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

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;

        if (this.config.debug) {
          console.log('[UnifiedDatafeed] WebSocket disconnected, reconnecting...');
        }

        // Reconnect after a delay
        this.reconnectTimeout = setTimeout(() => {
          this.connectWebSocket();
        }, 2000);
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
      console.log('[UnifiedDatafeed] ⚠️ WebSocket not ready for resubscription');
      return;
    }

    console.log('[UnifiedDatafeed] 🔄 Resubscribing to', this.subscriptions.size, 'subscriptions');

    for (const [subscriptionKey, subscriptionInfo] of this.subscriptions.entries()) {
      const rawTicker = subscriptionInfo.symbolInfo.ticker ?? '';
      // Clean token address: remove _MCAP suffix if present
      const tokenAddress = subscriptionInfo.isMarketCapMode
        ? rawTicker.replace(/_MCAP$/, '')
        : rawTicker;
      const timeframe = this.resolutionToTimeframe(subscriptionInfo.resolution);

      console.log('[UnifiedDatafeed] 📝 Sending subscription:', {
        type: 'subscribe',
        cleanAddress: tokenAddress,
        timeframe,
        chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
        subscriptionKey,
      });

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
      console.log('[UnifiedDatafeed] 🎓 GRADUATION EVENT received:', {
        tokenAddress: update.tokenAddress,
        graduationState: update.graduationState,
      });

      // Clear last bars to force a fresh fetch
      if (update.tokenAddress) {
        const tokenLower = update.tokenAddress.toLowerCase();

        // Clear cached bars for this token (both price and mcap)
        this.lastBars.delete(tokenLower);
        this.lastBars.delete(`${tokenLower}_MCAP`);

        // Clear supply cache
        this.latestSupply.delete(tokenLower);

        console.log('[UnifiedDatafeed] 🔄 Cleared cached bars for graduated token');
        console.log('[UnifiedDatafeed] 📊 Active subscriptions:', this.subscriptions.size);

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
          console.log('[UnifiedDatafeed] ✅ Update matches subscription:', {
            updateToken: update.tokenAddress,
            subscriptionToken: tokenAddress,
            updateTimeframe: update.timeframe,
            subscriptionTimeframe: timeframe,
            updateChartType: update.chartType,
            subscriptionChartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
          });
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

              console.log('[UnifiedDatafeed] 📊 Calling onTick with updated bar:', {
                time: updatedBar.time,
                open: updatedBar.open,
                high: updatedBar.high,
                low: updatedBar.low,
                close: updatedBar.close,
                volume: updatedBar.volume,
                ticker,
                tokenAddress,
                timeframe,
                chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
              });

              try {
                subscriptionInfo.onTick(updatedBar);
                console.log('[UnifiedDatafeed] ✅ onTick called successfully');
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
                console.log('[UnifiedDatafeed] Updated existing bar via websocket:', updatedBar);
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

          console.log('[UnifiedDatafeed] 📊 Calling onTick with new bar:', {
            time: bar.time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            ticker,
            tokenAddress,
            timeframe,
            chartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
          });

          try {
            subscriptionInfo.onTick(bar);
            console.log('[UnifiedDatafeed] ✅ onTick called successfully for new bar');
          } catch (error) {
            console.error('[UnifiedDatafeed] ❌ Error calling onTick for new bar:', error);
          }

          if (!subscriptionInfo.isMarketCapMode) {
            this.handleMarketCapEmission(tokenAddress, update.candle, bar.close, candleTime);
          }

          if (this.config.debug) {
            console.log('[UnifiedDatafeed] Tick received:', bar);
          }
        } else {
          console.log('[UnifiedDatafeed] ❌ Update does not match subscription:', {
            updateToken: update.tokenAddress,
            subscriptionToken: tokenAddress,
            updateTimeframe: update.timeframe,
            subscriptionTimeframe: timeframe,
            updateChartType: update.chartType,
            subscriptionChartType: subscriptionInfo.isMarketCapMode ? 'mcap' : 'price',
            hasCandle: !!update.candle,
          });
        }
      }
    } else if (update.type === 'initial_data') {
      // Handle initial data sent by the backend
      if (this.config.debug) {
        console.log('[UnifiedDatafeed] Received initial data:', update.candles?.length, 'candles');
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
      console.log('[UnifiedDatafeed] onReady called');
    }

    setTimeout(() => {
      callback({
        supported_resolutions: ['1', '5', '15', '60', '240', '1D'] as ResolutionString[],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
      });
    }, 0);
  }

  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: SearchSymbolsCallback,
  ): void {
    if (this.config.debug) {
      console.log('[UnifiedDatafeed] searchSymbols:', userInput);
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
      console.log('[UnifiedDatafeed] getBars called:', {
        symbol,
        token: tokenAddress,
        mode: isMarketCapMode ? 'mcap' : 'price',
        resolution,
        timeframe,
        from: new Date(periodParams.from * 1000).toISOString(),
        to: new Date(periodParams.to * 1000).toISOString(),
        firstDataRequest: periodParams.firstDataRequest,
      });
    }

    try {
      // 🔥 PHASE 2: Progressive candle loading
      // Load only what's needed based on TradingView's request
      const limit = periodParams.firstDataRequest
        ? 150 // Initial load: Optimized for faster rendering (~50-75 visible + buffer)
        : periodParams.countBack || 150; // Scroll load: fetch what TradingView requests

      // Build URL with time range and limit for better control
      const url = `${this.config.apiBaseUrl}/api/v1/chart/${tokenAddress}/unified?timeframe=${timeframe}&from=${periodParams.from}&to=${periodParams.to}&limit=${limit}`;

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] 🔥 Phase 2: Progressive loading:', {
          firstDataRequest: periodParams.firstDataRequest,
          limit,
          countBack: periodParams.countBack,
          from: new Date(periodParams.from * 1000).toISOString(),
          to: new Date(periodParams.to * 1000).toISOString(),
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

      if (!candles || candles.length === 0) {
        if (this.config.debug) {
          console.log('[UnifiedDatafeed] No candles returned');
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
          console.log('[UnifiedDatafeed] No candles in requested range');
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
        this.lastBars.set(symbolInfo.ticker, bars[bars.length - 1]);
      }

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
          this.latestSupply.set(tokenAddress.toLowerCase(), supplyValue);
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
      console.log('[UnifiedDatafeed] 📊 getBars returning:', {
        tokenAddress,
        from: new Date(periodParams.from * 1000).toISOString(),
        to: new Date(periodParams.to * 1000).toISOString(),
        totalBars: bars.length,
        firstBar: bars[0]
          ? {
              time: new Date(bars[0].time).toISOString(),
              volume: bars[0].volume,
              close: bars[0].close,
            }
          : null,
        lastBar: bars[bars.length - 1]
          ? {
              time: new Date(bars[bars.length - 1].time).toISOString(),
              volume: bars[bars.length - 1].volume,
              close: bars[bars.length - 1].close,
            }
          : null,
        // Find candles around the trade time (05:15-05:20)
        candlesAround0515: bars
          .filter((b) => {
            const time = new Date(b.time);
            const hour = time.getUTCHours();
            const minute = time.getUTCMinutes();
            // Look for 05:00 to 05:30 range
            return hour === 5 && minute >= 0 && minute <= 30;
          })
          .map((b) => ({
            time: new Date(b.time).toISOString(),
            volume: b.volume,
            close: b.close,
            trades: filteredCandles.find((c) => c.timestamp * 1000 === b.time)?.trades || 0,
          })),
      });

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] Returning', bars.length, 'bars');
        console.log('[UnifiedDatafeed] First bar:', bars[0]);
        console.log('[UnifiedDatafeed] Last bar:', bars[bars.length - 1]);
      }

      // 🔥 PHASE 2: Tell TradingView if there's more data available
      // This enables smooth infinite scrolling
      const noData = bars.length === 0;
      const nextTime = bars.length > 0 ? bars[0].time / 1000 : undefined;

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
      });
    }

    // Store subscription info for the persistent WebSocket connection
    this.subscriptions.set(subscriptionKey, {
      symbolInfo,
      resolution,
      onTick,
      listenerGuid,
      isMarketCapMode,
    });

    // Connect WebSocket if not already connected
    this.connectWebSocket();

    // If WebSocket is already open, subscribe immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.config.debug) {
        console.log('[UnifiedDatafeed] WebSocket already open, subscribing immediately');
      }

      this.ws.send(
        JSON.stringify({
          type: 'subscribe',
          tokenAddress, // Now clean address without _MCAP
          timeframe,
          chartType: isMarketCapMode ? 'mcap' : 'price',
        }),
      );
    }
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

    // If no subscriptions left, close WebSocket connection
    if (this.subscriptions.size === 0 && this.ws) {
      if (this.config.debug) {
        console.log('[UnifiedDatafeed] No more subscriptions, closing WebSocket');
      }
      this.cleanup();
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
   * 🔥 REAL-TIME ENHANCEMENT: Start aggressive polling for active trading
   */
  private startAggressivePolling(tokenAddress: string, _lastTradeTime?: string): void {
    const key = tokenAddress;

    // Clear existing interval if any
    if (this.aggressivePollingIntervals.has(key)) {
      clearInterval(this.aggressivePollingIntervals.get(key)!);
    }

    if (this.config.debug) {
      console.log('[UnifiedDatafeed] 🔥 Starting aggressive polling for', tokenAddress);
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

            if (this.config.debug) {
              console.log('[UnifiedDatafeed] 🔥 Real-time update:', bar);
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
        console.log('[UnifiedDatafeed] 🔥 Stopped aggressive polling for', tokenAddress);
      }
    }
  }
}
