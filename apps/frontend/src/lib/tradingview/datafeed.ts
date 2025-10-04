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
import { DexApi } from '@/lib/api/dex';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface TokenMetadata {
  symbol: string;
  name: string;
  currentPriceACES: string;
  volume24h: string;
}

type DexMeta = DatabaseListing['dex'] | null | undefined;

interface DatafeedOptions {
  dex?: DexMeta;
}

export class BondingCurveDatafeed implements IBasicDataFeed {
  private static readonly MAX_GAP_FILL_DURATION_MS = 48 * 60 * 60 * 1000; // cap synthetic bars to ~2 days
  private static readonly MAX_CACHED_BARS = 5000;
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
  private dexMeta: DexMeta;
  private useDex: boolean;
  private realtimeSubscriptions = new Map<string, any>();
  private tokenMetadata: TokenMetadata | null = null;
  private lastHistoricalBarByTimeframe = new Map<string, Bar>();
  private historyCache = new Map<string, Bar[]>();

  constructor(tokenAddress: string, options: DatafeedOptions = {}) {
    this.tokenAddress = tokenAddress.toLowerCase();
    this.dexMeta = options.dex ?? null;
    this.useDex = Boolean(this.dexMeta?.isDexLive);
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
      onHistoryCallback(filteredCopy, { noData: false });
    };

    if (!periodParams.firstDataRequest && cachedBars) {
      console.log(
        `[TradingView] Serving ${cachedBars.length} cached bars for ${this.tokenAddress} ${timeframe}`,
      );
      deliverBars(cachedBars, false);
      return;
    }

    if (!periodParams.firstDataRequest) {
      console.log(
        '[TradingView] Subsequent history request with empty cache – fetching fresh data.',
      );
    }

    console.log(
      `[TradingView] Fetching bars: ${this.tokenAddress} ${timeframe}`,
      `from: ${new Date(periodParams.from * 1000).toISOString()}, to: ${new Date(periodParams.to * 1000).toISOString()}`,
    );

    // Fetch data from backend (has 10-second cache)
    this.fetchHistoricalData(resolution, periodParams.from, periodParams.to)
      .then(({ bars, nextTime }) => {
        if (bars.length === 0 && typeof nextTime === 'number') {
          onHistoryCallback([], { noData: true, nextTime });
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
      timeframeMs: this.timeframeToMs(timeframe),
      onRealtimeCallback,
      onResetCacheNeededCallback,
      isActive: true,
      lastBar: this.cloneBar(this.lastHistoricalBarByTimeframe.get(timeframe) || null),
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
    const timeframeMs = subscription.timeframeMs || this.timeframeToMs(subscription.timeframe);

    const interval = setInterval(async () => {
      if (!subscription.isActive) {
        clearInterval(interval);
        return;
      }

      try {
        const bar = this.useDex
          ? await this.fetchLatestDexBar(subscription.timeframe, timeframeMs)
          : await this.fetchLatestBondingBar(subscription.timeframe, timeframeMs);

        if (!bar) {
          return;
        }

        const lastBar = subscription.lastBar as Bar | null;
        const barChanged =
          !lastBar ||
          lastBar.time !== bar.time ||
          lastBar.close !== bar.close ||
          lastBar.volume !== bar.volume;

        if (!barChanged) {
          return;
        }

        if (lastBar && bar.time - lastBar.time > timeframeMs) {
          this.emitSyntheticGapBars(subscription, lastBar, bar.time, timeframeMs);
        }

        const referenceBar = subscription.lastBar as Bar | null;
        const bridgedBar = this.bridgeBar(referenceBar, bar);

        subscription.lastBar = bridgedBar;
        subscription.onRealtimeCallback(bridgedBar);
        this.updateHistoryCache(subscription.timeframe, bridgedBar);

        console.log(`[TradingView] Real-time update:`, {
          time: new Date(bridgedBar.time).toISOString(),
          price: bridgedBar.close,
          volume: bridgedBar.volume,
          source: this.useDex ? 'dex' : 'bonding',
        });
      } catch (error) {
        console.error(`[TradingView] Polling error for ${subscriberUID}:`, error);
      }
    }, 5000);

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
  ): Promise<{ bars: Bar[]; nextTime?: number }> {
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
    const bondingBars: Bar[] = [];

    const timeframeMs = this.timeframeToMs(timeframe);

    console.log(`[TradingView] Received ${data.data.candles.length} bars from API`);

    for (let i = 0; i < data.data.candles.length; i++) {
      const candle = data.data.candles[i];
      const volumeEntry = data.data.volume?.[i];

      const bar: Bar = {
        time: this.alignTimeToTimeframe(candle.time * 1000, timeframeMs),
        open: Number(candle.open) || 0,
        high: Number(candle.high) || 0,
        low: Number(candle.low) || 0,
        close: Number(candle.close) || 0,
        volume: volumeEntry?.value ? Number(volumeEntry.value) : 0,
      };

      // Skip invalid bars
      if (bar.open > 0 || bar.high > 0 || bar.low > 0 || bar.close > 0) {
        bondingBars.push(bar);
      }
    }

    // Sort bars in ascending time order (TradingView requirement)
    bondingBars.sort((a, b) => a.time - b.time);

    let combinedBars = bondingBars;

    if (this.useDex) {
      const dexBars = await this.fetchDexHistoricalBars(resolution, timeframe);

      const cutoff = this.dexMeta?.bondingCutoff ? Date.parse(this.dexMeta.bondingCutoff) : null;
      const bondingFiltered = cutoff
        ? bondingBars.filter((bar) => bar.time < cutoff)
        : bondingBars;

      const merged = [...bondingFiltered, ...dexBars].sort((a, b) => a.time - b.time);
      const deduped = new Map<number, Bar>();
      for (const bar of merged) {
        deduped.set(bar.time, bar);
      }
      combinedBars = Array.from(deduped.values()).sort((a, b) => a.time - b.time);
    }

    if (combinedBars.length === 0) {
      return { bars: [] };
    }

    const fromMs = from * 1000;
    const toMs = to * 1000;
    const bufferMs = Math.max(timeframeMs, 60 * 1000);

    const rangeBars = combinedBars.filter((bar) => {
      return bar.time <= toMs + bufferMs;
    });

    if (rangeBars.length === 0) {
      const earliest = combinedBars[0];

      console.log(
        `[TradingView] No bars within requested range [${new Date(fromMs).toISOString()} - ${new Date(
          toMs,
        ).toISOString()}], earliest available is ${new Date(earliest.time).toISOString()}`,
      );

      return { bars: [], nextTime: Math.floor(earliest.time / 1000) };
    }

    const windowedBars = rangeBars.filter((bar) => bar.time >= fromMs - bufferMs);
    const barsToUse = windowedBars.length > 0 ? windowedBars : rangeBars;
    const barsWithGapsFilled = this.fillMissingBars(barsToUse, timeframeMs);

    console.log(
      `[TradingView] Returning ${barsWithGapsFilled.length} bars after gap fill (source=${rangeBars.length})`,
    );

    return { bars: barsWithGapsFilled };
  }

  private async fetchLatestBondingBar(
    timeframe: string,
    timeframeMs: number,
  ): Promise<Bar | null> {
    const apiUrl = this.getApiUrl(`/api/v1/tokens/${this.tokenAddress}/live?timeframe=${timeframe}`);
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const candles = data?.data?.candles;

    if (!data.success || !Array.isArray(candles) || candles.length === 0) {
      return null;
    }

    const latestCandle = candles[0];
    const volumeEntry = data.data.volume?.[0];

    const rawTime = Number(latestCandle.time) * 1000;
    const alignedTime = this.alignTimeToTimeframe(rawTime, timeframeMs);

    return {
      time: alignedTime,
      open: Number(latestCandle.open) || 0,
      high: Number(latestCandle.high) || 0,
      low: Number(latestCandle.low) || 0,
      close: Number(latestCandle.close) || 0,
      volume: volumeEntry?.value ? Number(volumeEntry.value) : 0,
    };
  }

  private async fetchLatestDexBar(
    timeframe: string,
    timeframeMs: number,
  ): Promise<Bar | null> {
    const lookback = Math.max(5, this.getDexLookbackMinutes(timeframe));
    const result = await DexApi.getCandles(this.tokenAddress, timeframe, lookback);

    if (!result.success) {
      return null;
    }

    const payload = result.data as any;
    const candles = Array.isArray(payload?.candles)
      ? payload.candles
      : Array.isArray(payload?.data?.candles)
        ? payload.data.candles
        : [];

    if (candles.length === 0) {
      return null;
    }

    const latest = candles[candles.length - 1];
    const startTime = Number(latest.startTime ?? latest.time ?? Date.now());
    const alignedTime = this.alignTimeToTimeframe(startTime, timeframeMs);

    return {
      time: alignedTime,
      open: Number(latest.open) || 0,
      high: Number(latest.high) || 0,
      low: Number(latest.low) || 0,
      close: Number(latest.close) || 0,
      volume: Number(latest.volumeToken ?? latest.volumeCounter ?? 0) || 0,
    };
  }

  private async fetchDexHistoricalBars(
    resolution: ResolutionString,
    timeframe: string,
  ): Promise<Bar[]> {
    const lookback = this.getDexLookbackMinutes(timeframe);
    const result = await DexApi.getCandles(this.tokenAddress, timeframe, lookback);

    if (!result.success) {
      return [];
    }

    const payload = result.data as any;
    const candles = Array.isArray(payload?.candles)
      ? payload.candles
      : Array.isArray(payload?.data?.candles)
        ? payload.data.candles
        : [];

    const timeframeMs = this.timeframeToMs(this.resolutionToTimeframe(resolution));

    return candles
      .map((candle: any) => ({
        time: this.alignTimeToTimeframe(Number(candle.startTime ?? candle.time ?? 0), timeframeMs),
        open: Number(candle.open) || 0,
        high: Number(candle.high) || 0,
        low: Number(candle.low) || 0,
        close: Number(candle.close) || 0,
        volume: Number(candle.volumeToken ?? candle.volumeCounter ?? 0) || 0,
      }))
      .filter((bar: Bar) => bar.time > 0 && (bar.open || bar.high || bar.low || bar.close))
      .sort((a: Bar, b: Bar) => a.time - b.time);
  }

  private getDexLookbackMinutes(timeframe: string): number {
    const mapping: Record<string, number> = {
      '5m': 60,
      '15m': 6 * 60,
      '1h': 24 * 60,
      '4h': 4 * 24 * 60,
      '1d': 14 * 24 * 60,
    };

    return mapping[timeframe] ?? 24 * 60;
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

  private timeframeToMs(timeframe: string): number {
    const mapping: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    return mapping[timeframe] ?? 60 * 60 * 1000;
  }

  private alignTimeToTimeframe(timeMs: number, timeframeMs: number): number {
    if (!Number.isFinite(timeMs) || timeframeMs <= 0) {
      return timeMs;
    }

    return Math.floor(timeMs / timeframeMs) * timeframeMs;
  }

  private fillMissingBars(bars: Bar[], timeframeMs: number): Bar[] {
    if (bars.length === 0 || timeframeMs <= 0) {
      return bars;
    }

    const filled: Bar[] = [];
    const sorted = [...bars].sort((a, b) => a.time - b.time);

    filled.push(this.bridgeBar(null, sorted[0]));

    const maxFillBars = Math.max(
      1,
      Math.floor(BondingCurveDatafeed.MAX_GAP_FILL_DURATION_MS / timeframeMs),
    );

    for (let i = 1; i < sorted.length; i++) {
      const previousBar = filled[filled.length - 1];
      const currentBar = sorted[i];

      const gapMs = currentBar.time - previousBar.time;

      if (gapMs > timeframeMs) {
        const missingBars = Math.floor(gapMs / timeframeMs) - 1;

        if (missingBars > 0) {
          const barsToInsert = Math.min(missingBars, maxFillBars);

          for (let j = 1; j <= barsToInsert; j++) {
            const syntheticTime = previousBar.time + timeframeMs * j;

            if (syntheticTime >= currentBar.time) {
              break;
            }

            const fillerBar: Bar = {
              time: syntheticTime,
              open: previousBar.close,
              high: previousBar.close,
              low: previousBar.close,
              close: previousBar.close,
              volume: 0,
            };

            filled.push(fillerBar);
          }
        }
      }

      const latestReference = filled[filled.length - 1];
      const bridgedBar = this.bridgeBar(latestReference, currentBar);
      filled.push(bridgedBar);
    }

    return filled;
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

  private emitSyntheticGapBars(
    subscription: any,
    previousBar: Bar,
    targetTime: number,
    timeframeMs: number,
  ) {
    if (timeframeMs <= 0) {
      return;
    }

    const maxFillBars = Math.max(
      1,
      Math.floor(BondingCurveDatafeed.MAX_GAP_FILL_DURATION_MS / timeframeMs),
    );

    const gapMs = targetTime - previousBar.time;
    const missingBars = Math.floor(gapMs / timeframeMs) - 1;

    if (missingBars <= 0) {
      return;
    }

    const barsToInsert = Math.min(missingBars, maxFillBars);

    for (let i = 1; i <= barsToInsert; i++) {
      const syntheticTime = previousBar.time + timeframeMs * i;

      if (syntheticTime >= targetTime) {
        break;
      }

      const fillerBar: Bar = {
        time: syntheticTime,
        open: previousBar.close,
        high: previousBar.close,
        low: previousBar.close,
        close: previousBar.close,
        volume: 0,
      };

      subscription.lastBar = fillerBar;
      subscription.onRealtimeCallback(fillerBar);
      this.updateHistoryCache(subscription.timeframe, fillerBar);
    }
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
