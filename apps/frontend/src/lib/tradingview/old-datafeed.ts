// import {
//   IBasicDataFeed,
//   LibrarySymbolInfo,
//   OnReadyCallback,
//   ResolveCallback,
//   HistoryCallback,
//   SubscribeBarsCallback,
//   Bar,
//   ResolutionString,
// } from '../../../public/charting_library/charting_library';
// import { useUnifiedChartData } from '@/hooks/chart/use-unified-chart-data';

// type UnifiedHookResult = ReturnType<typeof useUnifiedChartData>;
// type UnifiedCandle = UnifiedHookResult['candles'][number];
// type UnifiedGraduationState = UnifiedHookResult['graduationState'];

// interface TokenMetadata {
//   symbol: string;
//   name: string;
//   currentPriceACES: string;
//   volume24h: string;
// }

// interface UnifiedDataSubscription {
//   subscriberUID: string;
//   tokenAddress: string;
//   timeframe: string;
//   onRealtimeCallback: SubscribeBarsCallback;
//   onResetCacheNeededCallback: () => void;
//   isActive: boolean;
//   lastBar: Bar | null;
//   ws: WebSocket | null;
//   reconnectTimeout: ReturnType<typeof setTimeout> | null;
// }

// interface SearchSymbol {
//   symbol: string;
//   full_name: string;
//   description: string;
//   exchange: string;
//   ticker: string;
//   type: string;
// }

// interface WebSocketMessage {
//   type?: string;
//   error?: string;
//   graduationState?: UnifiedGraduationState;
//   candles?: UnifiedCandle[];
//   candle?: UnifiedCandle;
// }

// export class BondingCurveDatafeed implements IBasicDataFeed {
//   private static readonly MAX_GAP_FILL_DURATION_MS = 48 * 60 * 60 * 1000;
//   private static readonly MAX_CACHED_BARS = 5000;

//   searchSymbols(
//     userInput: string,
//     exchange: string,
//     symbolType: string,
//     onResultReadyCallback: (symbols: SearchSymbol[]) => void,
//   ): void {
//     onResultReadyCallback([]);
//   }

//   private tokenAddress: string;
//   private displayCurrency: 'usd' | 'aces';
//   private useDex: boolean;
//   private tokenMetadata: TokenMetadata | null = null;
//   private lastHistoricalBarByTimeframe = new Map<string, Bar>();
//   private historyCache = new Map<string, Bar[]>();
//   private unifiedDataSubscription: UnifiedDataSubscription | null = null;

//   constructor(tokenAddress: string, displayCurrency: 'usd' | 'aces' = 'usd') {
//     this.tokenAddress = tokenAddress.toLowerCase();
//     this.displayCurrency = displayCurrency;
//     this.useDex = false;
//   }

//   private getApiUrl(path: string): string {
//     if (typeof window === 'undefined') {
//       return path;
//     }

//     const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
//     if (apiBaseUrl) {
//       const cleanPath = path.startsWith('/') ? path.slice(1) : path;
//       const fullUrl = `${apiBaseUrl}/${cleanPath}`;
//       return fullUrl;
//     }

//     console.log('[TradingView] Using relative URL (development):', path);
//     return path;
//   }

//   onReady(callback: OnReadyCallback) {
//     setTimeout(() => {
//       callback({
//         supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
//         supports_marks: false,
//         supports_timescale_marks: false,
//         supports_time: true,
//         symbols_types: [
//           {
//             name: 'crypto',
//             value: 'crypto',
//           },
//         ],
//       });
//     }, 0);
//   }

//   async resolveSymbol(
//     symbolName: string,
//     onSymbolResolvedCallback: ResolveCallback,
//     onResolveErrorCallback: (reason: string) => void,
//   ) {
//     try {
//       if (!this.tokenMetadata) {
//         await this.fetchTokenMetadata();
//       }

//       // CRITICAL FIX: High precision for very small prices (down to 0.00000001)
//       // TradingView will automatically use subscript notation (0.0₄15) for small decimals
//       // pricescale: 10^10 supports 10 decimal places for micro-cap tokens
//       const precision = 10; // Support up to 10 decimal places
//       const pricescale = 10000000000; // 10^10 for 10 decimals (handles 0.0000000001)
//       const minmov = 1; // Smallest possible price movement

//       const symbolInfo: LibrarySymbolInfo = {
//         ticker: this.tokenMetadata?.symbol || symbolName,
//         name: `${this.tokenMetadata?.name || 'Token'} · ${this.tokenMetadata?.symbol || symbolName}`,
//         description: `${this.tokenMetadata?.name || 'Token'} - Bonding Curve Token`,
//         type: 'crypto',
//         session: '24x7',
//         timezone: 'Etc/UTC',
//         exchange: 'BondingCurve',
//         minmov: minmov,
//         pricescale: pricescale,
//         has_intraday: true,
//         has_daily: true,
//         supported_resolutions: ['5', '15', '60', '240', '1D'] as ResolutionString[],
//         volume_precision: 2,
//         data_status: 'streaming',
//         listed_exchange: 'BondingCurve',
//         // Use 'price' format which includes leading zero (e.g., 0.000008 or 0.0₅8)
//         format: 'price',
//       };

//       console.log('[TradingView] Symbol resolved with precision:', {
//         precision,
//         pricescale,
//         minmov: symbolInfo.minmov,
//         currency: this.displayCurrency,
//       });

//       setTimeout(() => onSymbolResolvedCallback(symbolInfo), 0);
//     } catch (error) {
//       console.error('[TradingView] Error resolving symbol:', error);
//       onResolveErrorCallback(error instanceof Error ? error.message : 'Failed to resolve symbol');
//     }
//   }

//   getBars(
//     symbolInfo: LibrarySymbolInfo,
//     resolution: ResolutionString,
//     periodParams: {
//       from: number;
//       to: number;
//       firstDataRequest: boolean;
//     },
//     onHistoryCallback: HistoryCallback,
//     onErrorCallback: (error: string) => void,
//   ) {
//     const timeframe = this.resolutionToTimeframe(resolution);
//     const cachedBars = this.historyCache.get(timeframe);
//     const fromMs = periodParams.from * 1000;
//     const toMs = periodParams.to * 1000;

//     const deliverBars = (sourceBars: Bar[], cacheSource: boolean) => {
//       const filtered = sourceBars.filter((bar) => bar.time >= fromMs && bar.time <= toMs);

//       if (cacheSource) {
//         const cachedCopy = this.cloneBars(sourceBars);
//         if (cachedCopy.length > 0) {
//           this.lastHistoricalBarByTimeframe.set(timeframe, cachedCopy[cachedCopy.length - 1]);
//         }
//         if (cachedCopy.length > BondingCurveDatafeed.MAX_CACHED_BARS) {
//           cachedCopy.splice(0, cachedCopy.length - BondingCurveDatafeed.MAX_CACHED_BARS);
//         }
//         this.historyCache.set(timeframe, cachedCopy);
//       }

//       if (filtered.length === 0) {
//         onHistoryCallback([], { noData: true });
//         return;
//       }

//       const filteredCopy = this.cloneBars(filtered);
//       this.lastHistoricalBarByTimeframe.set(timeframe, filteredCopy[filteredCopy.length - 1]);

//       // Log sample price to verify precision
//       if (filteredCopy.length > 0) {
//         console.log('[TradingView] Sample bar price:', {
//           open: filteredCopy[0].open,
//           close: filteredCopy[0].close,
//           time: new Date(filteredCopy[0].time).toISOString(),
//         });
//       }

//       onHistoryCallback(filteredCopy, { noData: false });
//     };

//     if (!periodParams.firstDataRequest && cachedBars) {
//       console.log(
//         `[TradingView] Serving ${cachedBars.length} cached bars for ${this.tokenAddress} ${timeframe}`,
//       );
//       deliverBars(cachedBars, false);
//       return;
//     }

//     console.log(
//       `[TradingView] Fetching bars: ${this.tokenAddress} ${timeframe}`,
//       `from: ${new Date(periodParams.from * 1000).toISOString()}, to: ${new Date(periodParams.to * 1000).toISOString()}`,
//     );

//     this.fetchHistoricalDataUnified(timeframe, periodParams.from, periodParams.to)
//       .then(({ bars }) => {
//         if (bars.length === 0) {
//           onHistoryCallback([], { noData: true });
//           this.historyCache.set(timeframe, []);
//           return;
//         }

//         deliverBars(bars, true);
//       })
//       .catch((error) => {
//         console.error('[TradingView] Error fetching bars:', error);
//         onErrorCallback(error instanceof Error ? error.message : 'Failed to fetch chart data');
//       });
//   }

//   private resolutionToTimeframe(resolution: ResolutionString): string {
//     switch (resolution) {
//       case '5':
//         return '5m';
//       case '15':
//         return '15m';
//       case '60':
//         return '1h';
//       case '240':
//         return '4h';
//       case '1D':
//         return '1d';
//       default:
//         return '1h';
//     }
//   }

//   subscribeBars(
//     symbolInfo: LibrarySymbolInfo,
//     resolution: ResolutionString,
//     onRealtimeCallback: SubscribeBarsCallback,
//     subscriberUID: string,
//     onResetCacheNeededCallback: () => void,
//   ) {
//     const timeframe = this.resolutionToTimeframe(resolution);

//     console.log(
//       `[TradingView] Starting WebSocket subscription for ${this.tokenAddress} ${timeframe}`,
//     );

//     if (this.unifiedDataSubscription) {
//       this.unsubscribeBars(this.unifiedDataSubscription.subscriberUID);
//     }

//     const subscription: UnifiedDataSubscription = {
//       subscriberUID,
//       tokenAddress: this.tokenAddress,
//       timeframe,
//       onRealtimeCallback,
//       onResetCacheNeededCallback,
//       isActive: true,
//       lastBar: this.cloneBar(this.lastHistoricalBarByTimeframe.get(timeframe) || null),
//       ws: null,
//       reconnectTimeout: null,
//     };

//     this.unifiedDataSubscription = subscription;
//     this.startUnifiedWebSocket();
//   }

//   unsubscribeBars(subscriberUID: string) {
//     if (!this.unifiedDataSubscription) {
//       return;
//     }

//     const subscription = this.unifiedDataSubscription;
//     if (subscription.subscriberUID !== subscriberUID) {
//       return;
//     }

//     subscription.isActive = false;

//     if (subscription.reconnectTimeout) {
//       clearTimeout(subscription.reconnectTimeout);
//       subscription.reconnectTimeout = null;
//     }

//     if (subscription.ws) {
//       const ws = subscription.ws;

//       if (ws.readyState === WebSocket.OPEN) {
//         ws.send(
//           JSON.stringify({
//             type: 'unsubscribe',
//             tokenAddress: this.tokenAddress,
//             timeframe: subscription.timeframe,
//           }),
//         );
//       }

//       ws.close();
//       subscription.ws = null;
//     }

//     this.unifiedDataSubscription = null;
//     console.log(`[TradingView] Unsubscribed from WebSocket: ${subscriberUID}`);
//   }

//   private startUnifiedWebSocket() {
//     if (typeof window === 'undefined') {
//       console.warn('[TradingView] WebSocket not started - window is undefined');
//       return;
//     }

//     const subscription = this.unifiedDataSubscription;

//     if (!subscription || !subscription.isActive) {
//       return;
//     }

//     if (subscription.reconnectTimeout) {
//       clearTimeout(subscription.reconnectTimeout);
//       subscription.reconnectTimeout = null;
//     }

//     if (subscription.ws) {
//       const state = subscription.ws.readyState;
//       if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
//         console.log('[TradingView] WebSocket already connecting/connected');
//         return;
//       }
//     }

//     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//     const wsUrl = process.env.NEXT_PUBLIC_API_URL
//       ? `${protocol}//${new URL(process.env.NEXT_PUBLIC_API_URL).host}/ws/chart`
//       : `${protocol}//${window.location.host}/ws/chart`;

//     try {
//       const ws = new WebSocket(wsUrl);
//       subscription.ws = ws;

//       ws.onopen = () => {
//         console.log('[TradingView] WebSocket connected');
//         if (!subscription.isActive) {
//           return;
//         }

//         ws.send(
//           JSON.stringify({
//             type: 'subscribe',
//             tokenAddress: subscription.tokenAddress,
//             timeframe: subscription.timeframe,
//           }),
//         );
//       };

//       ws.onmessage = (event) => {
//         if (!subscription.isActive) {
//           return;
//         }

//         try {
//           const message = JSON.parse(event.data);
//           this.handleUnifiedWebSocketMessage(message, subscription);
//         } catch (error) {
//           console.error('[TradingView] WebSocket message error:', error);
//         }
//       };

//       ws.onerror = (error) => {
//         console.error('[TradingView] WebSocket error:', error);
//       };

//       ws.onclose = () => {
//         console.log('[TradingView] WebSocket closed');

//         if (!subscription.isActive) {
//           return;
//         }

//         subscription.ws = null;
//         subscription.reconnectTimeout = setTimeout(() => {
//           console.log('[TradingView] Attempting WebSocket reconnection...');
//           this.startUnifiedWebSocket();
//         }, 3000);
//       };
//     } catch (error) {
//       console.error('[TradingView] Failed to start WebSocket:', error);
//     }
//   }

//   private handleUnifiedWebSocketMessage(
//     message: WebSocketMessage,
//     subscription: UnifiedDataSubscription,
//   ) {
//     if (!message || typeof message !== 'object') {
//       return;
//     }

//     const timeframeMs = this.timeframeToMs(subscription.timeframe);

//     if (message.graduationState) {
//       const graduationState = message.graduationState as UnifiedGraduationState;
//       this.useDex = Boolean(graduationState?.poolReady);
//     }

//     switch (message.type) {
//       case 'initial_data': {
//         const candles = Array.isArray(message.candles) ? (message.candles as UnifiedCandle[]) : [];
//         const bars = candles
//           .map((candle) => this.candleToBar(candle, timeframeMs))
//           .filter((bar): bar is Bar => Boolean(bar));

//         if (bars.length === 0) {
//           return;
//         }

//         const filledBars = this.fillMissingBars(bars, timeframeMs);
//         this.historyCache.set(subscription.timeframe, this.cloneBars(filledBars));
//         this.lastHistoricalBarByTimeframe.set(
//           subscription.timeframe,
//           filledBars[filledBars.length - 1],
//         );
//         subscription.lastBar = this.cloneBar(filledBars[filledBars.length - 1]);
//         subscription.onResetCacheNeededCallback();
//         break;
//       }

//       case 'candle_update': {
//         const bar = this.candleToBar(message.candle as UnifiedCandle, timeframeMs);

//         if (!bar) {
//           return;
//         }

//         const bridgedBar = this.bridgeBar(subscription.lastBar, bar);
//         subscription.lastBar = bridgedBar;
//         subscription.onRealtimeCallback(bridgedBar);
//         this.updateHistoryCache(subscription.timeframe, bridgedBar);
//         break;
//       }

//       case 'error': {
//         console.error('[TradingView] WebSocket server error:', message.error);
//         break;
//       }

//       default:
//         break;
//     }
//   }

//   private timeframeToMs(timeframe: string): number {
//     switch (timeframe) {
//       case '5m':
//         return 5 * 60 * 1000;
//       case '15m':
//         return 15 * 60 * 1000;
//       case '1h':
//         return 60 * 60 * 1000;
//       case '4h':
//         return 4 * 60 * 60 * 1000;
//       case '1d':
//         return 24 * 60 * 60 * 1000;
//       default:
//         return 60 * 60 * 1000;
//     }
//   }

//   private alignTimeToTimeframe(timestampMs: number, timeframeMs: number): number {
//     if (timeframeMs <= 0) {
//       return timestampMs;
//     }
//     return Math.floor(timestampMs / timeframeMs) * timeframeMs;
//   }

//   private candleToBar(
//     candle: Partial<UnifiedCandle> | null | undefined,
//     timeframeMs: number,
//   ): Bar | null {
//     if (!candle) {
//       return null;
//     }

//     const rawTimestamp =
//       typeof (candle as any).timestamp === 'number'
//         ? (candle as any).timestamp
//         : typeof (candle as any).time === 'number'
//           ? (candle as any).time
//           : Number((candle as any).timestamp ?? (candle as any).time ?? 0);

//     if (!Number.isFinite(rawTimestamp)) {
//       return null;
//     }

//     const timestampMs = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
//     const alignedTime = this.alignTimeToTimeframe(timestampMs, timeframeMs);

//     const priceFor = (key: 'open' | 'high' | 'low' | 'close'): number => {
//       const usdKey = `${key}Usd`;
//       const source =
//         this.displayCurrency === 'usd'
//           ? ((candle as any)[usdKey] ?? (candle as any)[key])
//           : (candle as any)[key];

//       const value = typeof source === 'string' ? parseFloat(source) : Number(source ?? 0);
//       return Number.isFinite(value) ? value : 0;
//     };

//     const open = priceFor('open');
//     const high = priceFor('high') || open;
//     const low = priceFor('low') || open;
//     const close = priceFor('close') || open;
//     const volume = Number((candle as any).volume ?? 0);

//     if (
//       !Number.isFinite(open) ||
//       !Number.isFinite(high) ||
//       !Number.isFinite(low) ||
//       !Number.isFinite(close)
//     ) {
//       return null;
//     }

//     if (open <= 0 && high <= 0 && low <= 0 && close <= 0) {
//       return null;
//     }

//     return {
//       time: alignedTime,
//       open,
//       high,
//       low,
//       close,
//       volume: Number.isFinite(volume) ? volume : 0,
//     };
//   }

//   private fillMissingBars(bars: Bar[], timeframeMs: number): Bar[] {
//     if (bars.length === 0) {
//       return [];
//     }

//     const filled: Bar[] = [];
//     const sortedBars = [...bars].sort((a, b) => a.time - b.time);

//     filled.push(sortedBars[0]);

//     for (let i = 1; i < sortedBars.length; i++) {
//       const prevBar = sortedBars[i - 1];
//       const currentBar = sortedBars[i];
//       const timeDiff = currentBar.time - prevBar.time;

//       if (timeDiff > timeframeMs && timeDiff <= BondingCurveDatafeed.MAX_GAP_FILL_DURATION_MS) {
//         const numMissingBars = Math.floor(timeDiff / timeframeMs) - 1;

//         for (let j = 1; j <= numMissingBars; j++) {
//           const syntheticTime = prevBar.time + j * timeframeMs;
//           const syntheticBar: Bar = {
//             time: syntheticTime,
//             open: prevBar.close,
//             high: prevBar.close,
//             low: prevBar.close,
//             close: prevBar.close,
//             volume: 0,
//           };
//           filled.push(syntheticBar);
//         }
//       }

//       filled.push(currentBar);
//     }

//     return filled;
//   }

//   private async fetchTokenMetadata(): Promise<void> {
//     try {
//       const apiUrl = this.getApiUrl(`/api/v1/tokens/${this.tokenAddress}`);
//       const response = await window.fetch(apiUrl);

//       if (!response.ok) {
//         throw new Error(`Failed to fetch token metadata: ${response.status}`);
//       }

//       const result = await response.json();

//       if (result.success && result.data) {
//         this.tokenMetadata = {
//           symbol: result.data.symbol || 'TOKEN',
//           name: result.data.name || 'Unknown Token',
//           currentPriceACES: result.data.currentPriceACES || '0',
//           volume24h: result.data.volume24h || '0',
//         };
//       }
//     } catch (error) {
//       console.error('[TradingView] Error fetching token metadata:', error);
//       this.tokenMetadata = {
//         symbol: 'TOKEN',
//         name: 'Unknown Token',
//         currentPriceACES: '0',
//         volume24h: '0',
//       };
//     }
//   }

//   private async fetchHistoricalDataUnified(
//     timeframe: string,
//     _from: number,
//     _to: number,
//   ): Promise<{ bars: Bar[] }> {
//     if (!this.tokenAddress || !this.tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
//       console.error('[TradingView] Invalid token address:', this.tokenAddress);
//       throw new Error('Invalid token address format');
//     }

//     const apiUrl = this.getApiUrl(`/api/v1/chart/${this.tokenAddress}`);
//     const params = new URLSearchParams({
//       timeframe,
//       includeUsd: 'true',
//     });

//     console.log(`[TradingView] Fetching: ${apiUrl}?${params.toString()}`);

//     const response = await window.fetch(`${apiUrl}?${params.toString()}`);

//     if (!response.ok) {
//       throw new Error(`API request failed: ${response.status}`);
//     }

//     const data = await response.json();

//     if (!data.success || !data.data?.candles) {
//       throw new Error('No chart data available');
//     }

//     const candles = data.data.candles;
//     const timeframeMs = this.timeframeToMs(timeframe);

//     const bars: Bar[] = candles
//       .map((candle: any) => {
//         const timestamp = candle.timestamp * 1000;

//         const open =
//           this.displayCurrency === 'usd'
//             ? parseFloat(candle.openUsd || candle.open)
//             : parseFloat(candle.open);

//         const high =
//           this.displayCurrency === 'usd'
//             ? parseFloat(candle.highUsd || candle.high)
//             : parseFloat(candle.high);

//         const low =
//           this.displayCurrency === 'usd'
//             ? parseFloat(candle.lowUsd || candle.low)
//             : parseFloat(candle.low);

//         const close =
//           this.displayCurrency === 'usd'
//             ? parseFloat(candle.closeUsd || candle.close)
//             : parseFloat(candle.close);

//         return {
//           time: timestamp,
//           open,
//           high,
//           low,
//           close,
//           volume: parseFloat(candle.volume || '0'),
//         };
//       })
//       .filter((bar: Bar) => {
//         const hasValidPrices = bar.open > 0 || bar.high > 0 || bar.low > 0 || bar.close > 0;
//         return hasValidPrices;
//       })
//       .sort((a: Bar, b: Bar) => a.time - b.time);

//     console.log(`[TradingView] Returning ${bars.length} bars`);

//     if (bars.length > 0) {
//       console.log('[TradingView] First bar:', {
//         time: new Date(bars[0].time).toISOString(),
//         open: bars[0].open,
//         close: bars[0].close,
//       });
//       console.log('[TradingView] Last bar:', {
//         time: new Date(bars[bars.length - 1].time).toISOString(),
//         open: bars[bars.length - 1].open,
//         close: bars[bars.length - 1].close,
//       });
//     }

//     const filledBars = this.fillMissingBars(bars, timeframeMs);

//     return { bars: filledBars };
//   }

//   private bridgeBar(previousBar: Bar | null, bar: Bar): Bar {
//     if (!bar) {
//       return bar;
//     }

//     const bridged: Bar = { ...bar };

//     if (!previousBar || previousBar.time === bridged.time) {
//       return bridged;
//     }

//     const prevClose = previousBar.close;

//     if (!Number.isFinite(prevClose)) {
//       return bridged;
//     }

//     bridged.open = prevClose;
//     bridged.high = Math.max(bridged.high, prevClose);
//     bridged.low = Math.min(bridged.low, prevClose);

//     return bridged;
//   }

//   private cloneBar(bar: Bar | null): Bar | null {
//     if (!bar) {
//       return null;
//     }

//     return { ...bar };
//   }

//   private cloneBars(bars: Bar[]): Bar[] {
//     return bars.map((bar) => ({ ...bar }));
//   }

//   private updateHistoryCache(timeframe: string, bar: Bar) {
//     const clonedBar = { ...bar };
//     const existing = this.historyCache.get(timeframe);

//     if (!existing || existing.length === 0) {
//       this.historyCache.set(timeframe, [clonedBar]);
//       this.lastHistoricalBarByTimeframe.set(timeframe, clonedBar);
//       return;
//     }

//     const updated = [...existing];
//     const lastIndex = updated.length - 1;

//     if (updated[lastIndex].time === clonedBar.time) {
//       updated[lastIndex] = clonedBar;
//     } else if (clonedBar.time > updated[lastIndex].time) {
//       updated.push(clonedBar);
//     } else {
//       const insertIndex = updated.findIndex((cachedBar) => cachedBar.time > clonedBar.time);

//       if (insertIndex === -1) {
//         updated.push(clonedBar);
//       } else if (updated[insertIndex].time === clonedBar.time) {
//         updated[insertIndex] = clonedBar;
//       } else {
//         updated.splice(insertIndex, 0, clonedBar);
//       }
//     }

//     if (updated.length > BondingCurveDatafeed.MAX_CACHED_BARS) {
//       updated.splice(0, updated.length - BondingCurveDatafeed.MAX_CACHED_BARS);
//     }

//     this.historyCache.set(timeframe, updated);
//     this.lastHistoricalBarByTimeframe.set(timeframe, updated[updated.length - 1]);
//   }
// }
