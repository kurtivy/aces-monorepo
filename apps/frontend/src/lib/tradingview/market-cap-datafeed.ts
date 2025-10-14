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

export class MarketCapDatafeed implements IBasicDataFeed {
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
   * Formats a value with compressed leading-zeros notation
   * Examples:
   *   0.00000487 → 0.0₅487 (5 leading zeros)
   *   0.0000000123 → 0.0₈123 (8 leading zeros)
   *   0.25 → 0.2500 (standard format)
   * This prevents scientific notation (e-notation) for very small values
   */
  public static formatPriceWithZeroCount(value: number, includeSymbol: boolean = true): string {
    if (value === 0 || value === null || value === undefined || !Number.isFinite(value)) {
      return includeSymbol ? '$0.00' : '0.00';
    }

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    const symbol = includeSymbol ? '$' : '';

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

    // Standard formatting for larger values
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

        if (bars.length > 0) {
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
    _onResetCacheNeededCallback: () => void,
  ) {
    console.log('[MarketCapDatafeed] Subscribe:', subscriberUID);
    // Real-time updates would use WebSocket here
  }

  unsubscribeBars(subscriberUID: string) {
    console.log('[MarketCapDatafeed] Unsubscribe:', subscriberUID);
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

    const candles = data.data.candles;

    interface MarketCapCandle {
      timestamp: number;
      open: number | string;
      high: number | string;
      low: number | string;
      close: number | string;
      marketCap?: number | string;
      marketCapUsd?: number | string;
      marketCapAces?: number | string;
      volume?: number | string;
    }

    const bars: Bar[] = candles
      .map((candle: MarketCapCandle) => {
        const timestamp = candle.timestamp * 1000;

        // Extract actual OHLC values from API response
        // The backend sends proper market cap OHLC calculated from price OHLC * supply
        const open = typeof candle.open === 'number' ? candle.open : parseFloat(candle.open || '0');
        const high = typeof candle.high === 'number' ? candle.high : parseFloat(candle.high || '0');
        const low = typeof candle.low === 'number' ? candle.low : parseFloat(candle.low || '0');
        const close =
          typeof candle.close === 'number' ? candle.close : parseFloat(candle.close || '0');

        // Validate at least one value is valid
        if (!Number.isFinite(close) && !Number.isFinite(open)) {
          return null;
        }

        // Use actual OHLC values to form proper candle bodies
        // This allows TradingView to render candles with visible bodies when market cap changes
        return {
          time: timestamp,
          open: open,
          high: high,
          low: low,
          close: close,
          volume:
            typeof candle.volume === 'number' ? candle.volume : parseFloat(candle.volume || '0'),
        };
      })
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

    return { bars };
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
