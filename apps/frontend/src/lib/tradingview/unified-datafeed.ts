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
  };
}

export class UnifiedDatafeed implements IBasicDataFeed {
  private config: UnifiedDatafeedConfig;
  private lastBars = new Map<string, Bar>();
  private subscribers = new Map<string, WebSocket>();

  constructor(config: UnifiedDatafeedConfig) {
    this.config = {
      ...config,
      debug: config.debug ?? false,
    };

    if (this.config.debug) {
      console.log('[UnifiedDatafeed] Initialized with config:', this.config);
    }
  }

  // Required TradingView methods

  onReady(callback: OnReadyCallback): void {
    if (this.config.debug) {
      console.log('[UnifiedDatafeed] onReady called');
    }

    setTimeout(() => {
      callback({
        supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
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
        pricescale: 1000000000000000000, // 18 decimals for precision
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: false,
        supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
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
      // Fetch from unified endpoint
      const url = `${this.config.apiBaseUrl}/api/v1/chart/${tokenAddress}/unified?timeframe=${timeframe}&limit=5000`;

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] Fetching from:', url);
      }

      const response = await fetch(url);
      const result: UnifiedChartResponse = await response.json();

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

      if (this.config.debug) {
        console.log('[UnifiedDatafeed] Returning', bars.length, 'bars');
        console.log('[UnifiedDatafeed] First bar:', bars[0]);
        console.log('[UnifiedDatafeed] Last bar:', bars[bars.length - 1]);
      }

      onResult(bars, { noData: false });
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
    const tokenAddress = symbolInfo.ticker;
    const timeframe = this.resolutionToTimeframe(resolution);
    const subscriptionKey = `${tokenAddress}:${timeframe}:${listenerGuid}`;

    if (this.config.debug) {
      console.log('[UnifiedDatafeed] subscribeBars:', subscriptionKey);
    }

    if (!this.config.wsUrl) {
      if (this.config.debug) {
        console.warn('[UnifiedDatafeed] No WebSocket URL configured, skipping subscription');
      }
      return;
    }

    try {
      const ws = new WebSocket(this.config.wsUrl);

      ws.onopen = () => {
        if (this.config.debug) {
          console.log('[UnifiedDatafeed] WebSocket connected for', subscriptionKey);
        }

        ws.send(
          JSON.stringify({
            type: 'subscribe',
            tokenAddress,
            timeframe,
            chartType: 'price',
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);

          if (update.type === 'candle_update') {
            const ticker = symbolInfo.ticker ?? tokenAddress ?? '';
            const lastBar = this.lastBars.get(ticker);
            const candleTime = update.candle.timestamp;

            // Prevent time violations - critical for TradingView
            if (lastBar && candleTime <= lastBar.time) {
              if (this.config.debug) {
                console.warn('[UnifiedDatafeed] Skipping update - time violation', {
                  candleTime,
                  lastBarTime: lastBar.time,
                });
              }
              return;
            }

            const bar: Bar = {
              time: candleTime,
              open: parseFloat(update.candle.open),
              high: parseFloat(update.candle.high),
              low: parseFloat(update.candle.low),
              close: parseFloat(update.candle.close),
              volume: parseFloat(update.candle.volume || '0'),
            };

            this.lastBars.set(ticker, bar);
            onTick(bar);

            if (this.config.debug) {
              console.log('[UnifiedDatafeed] Tick received:', bar);
            }
          }
        } catch (error) {
          console.error('[UnifiedDatafeed] Error processing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[UnifiedDatafeed] WebSocket error:', error);
      };

      ws.onclose = () => {
        if (this.config.debug) {
          console.log('[UnifiedDatafeed] WebSocket closed for', subscriptionKey);
        }
        this.subscribers.delete(subscriptionKey);
      };

      this.subscribers.set(subscriptionKey, ws);
    } catch (error) {
      console.error('[UnifiedDatafeed] Error creating WebSocket:', error);
    }
  }

  unsubscribeBars(listenerGuid: string): void {
    if (this.config.debug) {
      console.log('[UnifiedDatafeed] unsubscribeBars:', listenerGuid);
    }

    // Find and close all WebSockets for this listener
    for (const [key, ws] of this.subscribers.entries()) {
      if (key.endsWith(`:${listenerGuid}`)) {
        if (this.config.debug) {
          console.log('[UnifiedDatafeed] Closing WebSocket:', key);
        }
        ws.close();
        this.subscribers.delete(key);
      }
    }
  }

  // Helper methods

  private resolutionToTimeframe(resolution: ResolutionString): string {
    const map: Record<string, string> = {
      '5': '5m',
      '15': '15m',
      '60': '1h',
      '240': '4h',
      '1D': '1d',
      D: '1d',
    };

    return map[resolution] || '1h';
  }
}
