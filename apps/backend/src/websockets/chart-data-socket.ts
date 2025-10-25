import { FastifyInstance } from 'fastify';
import { ChartAggregationService } from '../services/chart-aggregation-service';
import { AcesPriceMonitor } from '../services/aces-price-monitor';
import { acesPriceTracker } from '../services/aces-price-tracker';

interface WebSocketClient {
  id: string;
  socket: any; // Fastify WebSocket socket
  subscriptions: Set<string>; // Set of "tokenAddress:timeframe:chartType"
  lastPing: number;
}

interface ChartDataWebSocketOptions {
  pollIntervalMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = Number(
  process.env.BITQUERY_POLL_INTERVAL_MS || 3000, // 750ms - ultra-fast real-time updates
);

export class ChartDataWebSocket {
  private clients = new Map<string, WebSocketClient>();
  private subscriptions = new Map<string, Set<string>>(); // "tokenAddress:timeframe:chartType" -> Set<clientId>
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private currentIntervalMs = new Map<string, number>(); // Track current interval for each subscription
  private lastBroadcast = new Map<string, { payload: any }>();
  private readonly pollIntervalMs: number;
  private graduationStateCache = new Map<
    string,
    { poolReady: boolean; poolAddress: string | null }
  >();
  private acesPriceMonitor: AcesPriceMonitor | null = null;

  constructor(
    private fastify: FastifyInstance,
    private chartService: ChartAggregationService,
    options: ChartDataWebSocketOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  /**
   * Initialize WebSocket server
   */
  async initialize() {
    // WebSocket route
    this.fastify.get('/ws/chart', { websocket: true } as any, (connection: any, req: any) => {
      const clientId = this.generateClientId();
      console.log(`[WebSocket] Client connected: ${clientId}`);

      const client: WebSocketClient = {
        id: clientId,
        socket: connection.socket,
        subscriptions: new Set(),
        lastPing: Date.now(),
      };

      this.clients.set(clientId, client);

      // Handle messages from client
      connection.socket.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error('[WebSocket] Invalid message:', error);
        }
      });

      // Handle disconnection
      connection.socket.on('close', () => {
        console.log(`[WebSocket] Client disconnected: ${clientId}`);
        this.handleClientDisconnect(clientId);
      });

      // Send welcome message
      connection.socket.send(
        JSON.stringify({
          type: 'connected',
          clientId,
          timestamp: Date.now(),
        }),
      );
    });

    // Start heartbeat checker
    this.startHeartbeat();

    // Initialize and start ACES price monitoring
    const acesUsdPriceService = (this.fastify as any).acesUsdPriceService;
    if (acesUsdPriceService) {
      this.acesPriceMonitor = new AcesPriceMonitor(acesUsdPriceService, this.pollIntervalMs);
      this.acesPriceMonitor.start();

      // Listen for ACES price updates
      this.acesPriceMonitor.on('price-update', (update) => {
        this.handleAcesPriceUpdate(update);
      });

      console.log('✅ ACES price monitoring active');
    } else {
      console.warn('⚠️ AcesUsdPriceService not available, ACES monitoring disabled');
    }

    console.log('✅ WebSocket server initialized on /ws/chart');
  }

  /**
   * Handle client messages (subscribe/unsubscribe)
   */
  private handleClientMessage(clientId: string, data: { type: string; [key: string]: unknown }) {
    console.log(`[WebSocket] 📨 Received message from ${clientId}:`, JSON.stringify(data, null, 2));

    const client = this.clients.get(clientId);
    if (!client) {
      console.log(`[WebSocket] ⚠️ Client ${clientId} not found`);
      return;
    }

    switch (data.type) {
      case 'subscribe':
        this.subscribe(
          clientId,
          data.tokenAddress as string,
          data.timeframe as string,
          (data.chartType as 'price' | 'mcap') || 'price', // Default to price for backwards compatibility
        );
        break;

      case 'unsubscribe':
        this.unsubscribe(
          clientId,
          data.tokenAddress as string,
          data.timeframe as string,
          (data.chartType as 'price' | 'mcap') || 'price',
        );
        break;

      case 'ping':
        client.lastPing = Date.now();
        client.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        console.warn('[WebSocket] Unknown message type:', data.type);
    }
  }

  /**
   * Subscribe client to token updates
   */
  private subscribe(
    clientId: string,
    tokenAddress: string,
    timeframe: string,
    chartType: 'price' | 'mcap' = 'price',
  ) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const subscriptionKey = `${tokenAddress.toLowerCase()}:${timeframe}:${chartType}`;

    // Add to client subscriptions
    client.subscriptions.add(subscriptionKey);

    // Add to global subscriptions
    if (!this.subscriptions.has(subscriptionKey)) {
      this.subscriptions.set(subscriptionKey, new Set());
    }
    this.subscriptions.get(subscriptionKey)!.add(clientId);

    console.log(`[WebSocket] ✅ Client ${clientId} subscribed to ${subscriptionKey}`);
    console.log(
      `[WebSocket] 📊 Total subscribers for ${subscriptionKey}: ${this.subscriptions.get(subscriptionKey)!.size}`,
    );

    // Start polling if this is first subscriber
    if (this.subscriptions.get(subscriptionKey)!.size === 1) {
      console.log(`[WebSocket] 🚀 Starting polling for ${subscriptionKey} (first subscriber)`);
      this.startPolling(tokenAddress.toLowerCase(), timeframe, chartType);
    } else {
      console.log(`[WebSocket] 📡 Already polling for ${subscriptionKey}, adding subscriber`);
    }

    // Send immediate update (async - don't await to avoid blocking)
    this.sendUpdate(clientId, tokenAddress.toLowerCase(), timeframe, chartType).catch((error) => {
      console.error(`[WebSocket] Error sending initial data to ${clientId}:`, error);
    });
  }

  /**
   * Unsubscribe client from token updates
   */
  private unsubscribe(
    clientId: string,
    tokenAddress: string,
    timeframe: string,
    chartType: 'price' | 'mcap' = 'price',
  ) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const subscriptionKey = `${tokenAddress.toLowerCase()}:${timeframe}:${chartType}`;

    client.subscriptions.delete(subscriptionKey);
    this.subscriptions.get(subscriptionKey)?.delete(clientId);

    console.log(`[WebSocket] Client ${clientId} unsubscribed from ${subscriptionKey}`);

    // Stop polling if no more subscribers
    if (this.subscriptions.get(subscriptionKey)?.size === 0) {
      this.stopPolling(subscriptionKey);
      this.subscriptions.delete(subscriptionKey);
    }
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all subscriptions
    for (const subscriptionKey of client.subscriptions) {
      this.subscriptions.get(subscriptionKey)?.delete(clientId);

      // Stop polling if no more subscribers
      if (this.subscriptions.get(subscriptionKey)?.size === 0) {
        this.stopPolling(subscriptionKey);
        this.subscriptions.delete(subscriptionKey);
      }
    }

    this.clients.delete(clientId);
  }

  /**
   * Start polling for a token/timeframe
   */
  private startPolling(
    tokenAddress: string,
    timeframe: string,
    chartType: 'price' | 'mcap' = 'price',
  ) {
    const subscriptionKey = `${tokenAddress}:${timeframe}:${chartType}`;

    if (this.pollingIntervals.has(subscriptionKey)) {
      console.log(`⚠️ [WebSocket] Already polling ${subscriptionKey}`);
      return; // Already polling
    }

    console.log(
      `🚀 [WebSocket] Starting polling for ${subscriptionKey} (every ${this.pollIntervalMs}ms)`,
    );

    // Poll at configured interval – throttled to avoid exhausting BitQuery quota
    const interval = setInterval(async () => {
      console.log(
        `⏰ [WebSocket] Polling tick for ${subscriptionKey} (interval: ${this.pollIntervalMs}ms)`,
      );
      if (chartType === 'mcap') {
        await this.pollAndBroadcastMarketCap(tokenAddress, timeframe);
      } else {
        await this.pollAndBroadcast(tokenAddress, timeframe);
      }
    }, this.pollIntervalMs);

    this.pollingIntervals.set(subscriptionKey, interval);
    this.currentIntervalMs.set(subscriptionKey, this.pollIntervalMs); // Track initial interval
    console.log(`✅ [WebSocket] Interval set, ID:`, interval);

    // Do initial poll immediately
    console.log(`📍 [WebSocket] Doing initial poll for ${subscriptionKey}`);
    if (chartType === 'mcap') {
      this.pollAndBroadcastMarketCap(tokenAddress, timeframe);
    } else {
      this.pollAndBroadcast(tokenAddress, timeframe);
    }
  }

  /**
   * Stop polling for a token/timeframe
   */
  private stopPolling(subscriptionKey: string) {
    const interval = this.pollingIntervals.get(subscriptionKey);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(subscriptionKey);
      this.currentIntervalMs.delete(subscriptionKey); // Clean up interval tracking
      this.lastBroadcast.delete(subscriptionKey);
      console.log(`[WebSocket] Stopped polling for ${subscriptionKey}`);
    }
  }

  /**
   * Poll data and broadcast to subscribers (PRICE chart)
   */
  private async pollAndBroadcast(tokenAddress: string, timeframe: string) {
    try {
      const subscriptionKey = `${tokenAddress}:${timeframe}:price`;
      const subscribers = this.subscriptions.get(subscriptionKey);

      // Defensive cleanup: if no subscribers, stop polling immediately
      if (!subscribers || subscribers.size === 0) {
        console.warn(`⚠️ [WebSocket] No subscribers for ${subscriptionKey}, stopping polling`);
        this.stopPolling(subscriptionKey);
        this.subscriptions.delete(subscriptionKey);
        return;
      }

      console.log(
        `🔄 [WebSocket] Polling PRICE ${tokenAddress} ${timeframe} (${subscribers.size} subscribers)...`,
      );

      // Get latest candle - using new ChartAggregationService
      // TODO: Implement getLatestCandle method in ChartAggregationService
      // For now, get the full chart data and take the last candle
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      const chartData = await this.chartService.getChartData(tokenAddress, {
        timeframe,
        from,
        to: now,
        limit: 1,
      });

      console.log(`[WebSocket] 📊 Retrieved chart data:`, {
        tokenAddress,
        timeframe,
        candlesCount: chartData.candles.length,
        hasCandles: chartData.candles.length > 0,
      });

      const candle =
        chartData.candles.length > 0 ? chartData.candles[chartData.candles.length - 1] : null;

      if (candle) {
        console.log(`[WebSocket] 📈 Latest candle:`, {
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          openUsd: candle.openUsd,
          closeUsd: candle.closeUsd,
          volume: candle.volume,
          trades: candle.trades,
          dataSource: candle.dataSource,
        });
      } else {
        console.warn(`[WebSocket] ⚠️ No candle data returned for ${tokenAddress}:${timeframe}`);
      }

      if (!candle) {
        const cached = this.lastBroadcast.get(subscriptionKey);
        if (cached) {
          const replayPayload = {
            ...cached.payload,
            timestamp: Date.now(),
            candle: { ...cached.payload.candle },
          };
          const replayMessage = JSON.stringify(replayPayload);
          let replayCount = 0;
          for (const clientId of subscribers) {
            const client = this.clients.get(clientId);
            if (client && client.socket.readyState === 1) {
              try {
                client.socket.send(replayMessage);
                replayCount++;
              } catch (error) {
                console.error(`❌ [WebSocket] Failed to send cached candle to ${clientId}:`, error);
              }
            }
          }
          console.log(
            `♻️ [WebSocket] Replayed last candle for ${subscriptionKey} to ${replayCount}/${subscribers.size} clients`,
          );
        } else {
          console.warn(`⚠️ [WebSocket] No candle returned for ${tokenAddress} ${timeframe}`);
        }
        return;
      }

      console.log(`📊 [WebSocket] Latest candle:`, {
        dataSource: candle.dataSource,
        timestamp: candle.timestamp,
        close: candle.close,
        closeUsd: candle.closeUsd,
        open: candle.open,
        openUsd: candle.openUsd,
        high: candle.high,
        highUsd: candle.highUsd,
        low: candle.low,
        lowUsd: candle.lowUsd,
        volume: candle.volume,
        trades: candle.trades,
      });

      // Get current graduation state from the chart data we just fetched
      const currentGraduationState = chartData.graduationState;

      console.log(`🎓 [WebSocket] Graduation state:`, {
        poolReady: currentGraduationState.poolReady,
        poolAddress: currentGraduationState.poolAddress,
        dexLiveAt: currentGraduationState.dexLiveAt,
      });

      // Check for graduation event
      const cachedState = this.graduationStateCache.get(tokenAddress);
      const justGraduated =
        cachedState &&
        !cachedState.poolReady &&
        currentGraduationState.poolReady &&
        currentGraduationState.poolAddress;

      if (justGraduated) {
        console.log(`🎓 [WebSocket] Token ${tokenAddress} just graduated to DEX!`, {
          poolAddress: currentGraduationState.poolAddress,
          dexLiveAt: currentGraduationState.dexLiveAt,
        });

        // Broadcast graduation event to ALL subscribers of this token (all timeframes)
        this.broadcastGraduationEvent(tokenAddress, currentGraduationState);
      }

      // Update cached state
      this.graduationStateCache.set(tokenAddress, {
        poolReady: currentGraduationState.poolReady,
        poolAddress: currentGraduationState.poolAddress,
      });

      const payload = {
        type: 'candle_update',
        tokenAddress,
        timeframe,
        chartType: 'price',
        candle: {
          timestamp: candle.timestamp.getTime(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          openUsd: candle.openUsd,
          highUsd: candle.highUsd,
          lowUsd: candle.lowUsd,
          closeUsd: candle.closeUsd,
          volume: candle.volume,
          volumeUsd: candle.volumeUsd,
          trades: candle.trades,
          dataSource: candle.dataSource,
        },
        graduationState: currentGraduationState,
        timestamp: Date.now(),
      };

      console.log(`[WebSocket] 📤 Broadcasting candle_update for ${tokenAddress}:${timeframe}:`, {
        timestamp: payload.candle.timestamp,
        close: payload.candle.close,
        closeUsd: payload.candle.closeUsd,
        volume: payload.candle.volume,
        trades: payload.candle.trades,
        dataSource: payload.candle.dataSource,
      });

      const message = JSON.stringify(payload);

      // Broadcast to all subscribers
      let sentCount = 0;
      for (const clientId of subscribers) {
        const client = this.clients.get(clientId);
        if (client && client.socket.readyState === 1) {
          // WebSocket.OPEN
          try {
            client.socket.send(message);
            sentCount++;
          } catch (error) {
            console.error(`❌ [WebSocket] Failed to send to ${clientId}:`, error);
          }
        } else {
          console.warn(
            `⚠️ [WebSocket] Client ${clientId} not ready, readyState:`,
            client?.socket.readyState,
          );
        }
      }

      console.log(
        `📡 [WebSocket] Broadcast ${subscriptionKey} to ${sentCount}/${subscribers.size} clients`,
      );

      if (sentCount === 0) {
        console.log(`⚠️ [WebSocket] No clients received the broadcast for ${subscriptionKey}`);
        console.log(
          `🔍 [WebSocket] Client states:`,
          Array.from(subscribers).map((clientId) => {
            const client = this.clients.get(clientId);
            return { clientId, readyState: client?.socket.readyState };
          }),
        );
      }

      this.lastBroadcast.set(subscriptionKey, { payload });

      // 🔥 DISABLED: Dynamic polling optimization was causing constant interval restarts
      // This was preventing real-time updates. Keep polling at consistent 2.5s interval.
      // this.adjustPollingInterval(subscriptionKey, tokenAddress, timeframe, candle);
    } catch (error) {
      console.error('❌ [WebSocket] Poll error:', error);
      console.error('Stack trace:', error);
    }
  }

  /**
   * Adjust polling interval dynamically based on trading activity
   * Active trading = faster polling, low activity = slower polling
   */
  private adjustPollingInterval(
    subscriptionKey: string,
    tokenAddress: string,
    timeframe: string,
    candle: any,
  ) {
    const candleAge = Date.now() - candle.timestamp.getTime();
    let newInterval: number;

    if (candleAge < 30000) {
      // Active trading (< 30s old)
      newInterval = 1500; // Poll every 1.5s
    } else if (candleAge < 120000) {
      // Moderate activity (< 2m old)
      newInterval = 5000; // Poll every 5s
    } else {
      // Low activity (> 2m old)
      newInterval = 10000; // Poll every 10s
    }

    // Get current interval
    const currentInterval = this.pollingIntervals.get(subscriptionKey);

    // Only restart if interval changed significantly (avoid unnecessary restarts)
    if (!currentInterval || Math.abs(newInterval - this.pollIntervalMs) > 1000) {
      console.log(`⏱️ [WebSocket] Adjusting polling interval for ${subscriptionKey}:`, {
        candleAge: `${(candleAge / 1000).toFixed(1)}s`,
        newInterval: `${newInterval}ms`,
        oldInterval: this.pollIntervalMs,
      });

      // Stop current polling
      this.stopPolling(subscriptionKey);

      // Start new polling with adjusted interval
      const interval = setInterval(() => {
        this.pollAndBroadcast(tokenAddress, timeframe);
      }, newInterval);

      this.pollingIntervals.set(subscriptionKey, interval);
    }
  }

  /**
   * Poll market cap data and broadcast to subscribers (MCAP chart)
   */
  private async pollAndBroadcastMarketCap(tokenAddress: string, timeframe: string) {
    try {
      console.log(`🔄 [WebSocket] Polling MARKET CAP ${tokenAddress} ${timeframe}...`);

      const subscriptionKey = `${tokenAddress}:${timeframe}:mcap`;
      const subscribers = this.subscriptions.get(subscriptionKey);

      // Defensive cleanup: if no subscribers, stop polling immediately
      if (!subscribers || subscribers.size === 0) {
        console.warn(`⚠️ [WebSocket] No subscribers for ${subscriptionKey}, stopping polling`);
        this.stopPolling(subscriptionKey);
        this.subscriptions.delete(subscriptionKey);
        return;
      }

      // Get latest candle and graduation state - using new ChartAggregationService
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      const chartData = await this.chartService.getChartData(tokenAddress, {
        timeframe,
        from,
        to: now,
        limit: 1,
      });

      const candle =
        chartData.candles.length > 0 ? chartData.candles[chartData.candles.length - 1] : null;

      if (!candle) {
        console.warn(`⚠️ [WebSocket] No candle returned for ${tokenAddress} ${timeframe}`);
        return;
      }

      const currentGraduationState = chartData.graduationState;

      // Check for graduation event
      const cachedState = this.graduationStateCache.get(tokenAddress);
      const justGraduated =
        cachedState &&
        !cachedState.poolReady &&
        currentGraduationState.poolReady &&
        currentGraduationState.poolAddress;

      if (justGraduated) {
        console.log(`🎓 [WebSocket] Token ${tokenAddress} just graduated to DEX!`, {
          poolAddress: currentGraduationState.poolAddress,
          dexLiveAt: currentGraduationState.dexLiveAt,
        });

        // Broadcast graduation event to ALL subscribers of this token (all timeframes)
        this.broadcastGraduationEvent(tokenAddress, currentGraduationState);
      }

      // Update cached state
      this.graduationStateCache.set(tokenAddress, {
        poolReady: currentGraduationState.poolReady,
        poolAddress: currentGraduationState.poolAddress,
      });

      // Prefer candle.circulatingSupply if available; fallback based on graduation state
      let supply = 0;
      if (candle.circulatingSupply) {
        supply =
          typeof candle.circulatingSupply === 'string'
            ? parseFloat(candle.circulatingSupply)
            : (candle.circulatingSupply as unknown as number);
      } else {
        supply = currentGraduationState?.poolReady
          ? parseFloat(candle.circulatingSupply || '0') // DEX: use actual circulating supply
          : 800000000; // Bonding curve: fallback to fixed 800M only if missing
      }

      // Calculate market cap OHLC
      const openUsd = parseFloat(candle.openUsd || '0');
      const highUsd = parseFloat(candle.highUsd || '0');
      const lowUsd = parseFloat(candle.lowUsd || '0');
      const closeUsd = parseFloat(candle.closeUsd || '0');

      const mcapCandle = {
        timestamp: candle.timestamp.getTime(),
        open: supply * openUsd,
        high: supply * highUsd,
        low: supply * lowUsd,
        close: supply * closeUsd,
        volume: candle.volume,
        trades: candle.trades,
        dataSource: candle.dataSource,
      };

      console.log(`✅ [WebSocket] Got market cap candle for ${tokenAddress} ${timeframe}:`, {
        timestamp: candle.timestamp,
        supply,
        supplySource: candle.circulatingSupply
          ? 'circulating (from candle)'
          : currentGraduationState?.poolReady
            ? 'circulating (DEX)'
            : 'fixed 800M (bonding)',
        priceClose: closeUsd,
        mcapClose: mcapCandle.close,
      });

      const message = JSON.stringify({
        type: 'candle_update',
        tokenAddress,
        timeframe,
        chartType: 'mcap',
        candle: mcapCandle,
        graduationState: currentGraduationState,
        timestamp: Date.now(),
      });

      // Broadcast to all subscribers
      let sentCount = 0;
      for (const clientId of subscribers) {
        const client = this.clients.get(clientId);
        if (client && client.socket.readyState === 1) {
          // WebSocket.OPEN
          try {
            client.socket.send(message);
            sentCount++;
          } catch (error) {
            console.error(`❌ [WebSocket] Failed to send to ${clientId}:`, error);
          }
        } else {
          console.warn(
            `⚠️ [WebSocket] Client ${clientId} not ready, readyState:`,
            client?.socket.readyState,
          );
        }
      }

      console.log(
        `📡 [WebSocket] Broadcast ${subscriptionKey} to ${sentCount}/${subscribers.size} clients`,
      );

      if (sentCount === 0) {
        console.log(
          `⚠️ [WebSocket] No clients received the market cap broadcast for ${subscriptionKey}`,
        );
        console.log(
          `🔍 [WebSocket] Client states:`,
          Array.from(subscribers).map((clientId) => {
            const client = this.clients.get(clientId);
            return { clientId, readyState: client?.socket.readyState };
          }),
        );
      }
    } catch (error) {
      console.error('❌ [WebSocket] Market cap poll error:', error);
      console.error('Stack trace:', error);
    }
  }

  /**
   * Send immediate update to specific client
   */
  private async sendUpdate(
    clientId: string,
    tokenAddress: string,
    timeframe: string,
    chartType: 'price' | 'mcap' = 'price',
  ) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`[WebSocket] ⚠️ Client ${clientId} not found when sending update`);
      return;
    }

    // Check if socket is still open before proceeding
    if (client.socket.readyState !== 1) {
      console.warn(
        `[WebSocket] ⚠️ Client ${clientId} socket not open (readyState: ${client.socket.readyState})`,
      );
      return;
    }

    try {
      console.log(`[WebSocket] 📤 Fetching initial chart data for ${clientId}...`);
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days for initial load
      const chartData = await this.chartService.getChartData(tokenAddress, {
        timeframe,
        from,
        to: now,
        limit: 100, // Send last 100 candles on subscribe
      });
      console.log(`[WebSocket] ✅ Got ${chartData.candles.length} candles for ${clientId}`);

      if (chartType === 'mcap') {
        // Calculate market cap candles
        const supply = chartData.graduationState?.poolReady ? null : 800000000; // Fixed 800M for bonding curve

        const mcapCandles = chartData.candles.map((c: any) => {
          const candleSupply = supply ?? parseFloat(c.circulatingSupply || '0');
          const openUsd = parseFloat(c.openUsd || '0');
          const highUsd = parseFloat(c.highUsd || '0');
          const lowUsd = parseFloat(c.lowUsd || '0');
          const closeUsd = parseFloat(c.closeUsd || '0');

          return {
            timestamp: c.timestamp.getTime(),
            open: candleSupply * openUsd,
            high: candleSupply * highUsd,
            low: candleSupply * lowUsd,
            close: candleSupply * closeUsd,
            volume: c.volume,
            trades: c.trades,
            dataSource: c.dataSource,
          };
        });

        const message = JSON.stringify({
          type: 'initial_data',
          tokenAddress,
          timeframe,
          chartType: 'mcap',
          candles: mcapCandles,
          graduationState: chartData.graduationState,
          acesUsdPrice: chartData.acesUsdPrice,
          timestamp: Date.now(),
        });

        // Double-check socket is still open before sending
        if (client.socket.readyState === 1) {
          client.socket.send(message);
        } else {
          console.warn(`[WebSocket] ⚠️ Socket closed before sending mcap data to ${clientId}`);
        }
      } else {
        // Send price candles (existing behavior)
        const subscriptionKey = `${tokenAddress}:${timeframe}:${chartType}`;
        const message = JSON.stringify({
          type: 'initial_data',
          tokenAddress,
          timeframe,
          chartType: 'price',
          candles: chartData.candles.map((c: any) => ({
            timestamp: c.timestamp.getTime(),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            openUsd: c.openUsd,
            highUsd: c.highUsd,
            lowUsd: c.lowUsd,
            closeUsd: c.closeUsd,
            volume: c.volume,
            volumeUsd: c.volumeUsd,
            trades: c.trades,
            dataSource: c.dataSource,
          })),
          graduationState: chartData.graduationState,
          acesUsdPrice: chartData.acesUsdPrice,
          timestamp: Date.now(),
        });

        // Double-check socket is still open before sending
        if (client.socket.readyState === 1) {
          client.socket.send(message);
          console.log(
            `[WebSocket] 📨 Sent initial_data to ${clientId} (${chartData.candles.length} candles)`,
          );
          const lastPriceCandle = chartData.candles[chartData.candles.length - 1];
          if (lastPriceCandle) {
            const candleTimestamp =
              lastPriceCandle.timestamp instanceof Date
                ? lastPriceCandle.timestamp.getTime()
                : new Date(lastPriceCandle.timestamp).getTime();

            const initialUpdatePayload = {
              type: 'candle_update',
              tokenAddress,
              timeframe,
              chartType: 'price', // ✅ Added missing chartType field
              candle: {
                timestamp: candleTimestamp,
                open: lastPriceCandle.open,
                high: lastPriceCandle.high,
                low: lastPriceCandle.low,
                close: lastPriceCandle.close,
                openUsd: lastPriceCandle.openUsd,
                highUsd: lastPriceCandle.highUsd,
                lowUsd: lastPriceCandle.lowUsd,
                closeUsd: lastPriceCandle.closeUsd,
                volume: lastPriceCandle.volume,
                volumeUsd: lastPriceCandle.volumeUsd,
                trades: lastPriceCandle.trades,
                dataSource: lastPriceCandle.dataSource,
              },
              graduationState: chartData.graduationState,
              timestamp: Date.now(),
            };

            try {
              client.socket.send(JSON.stringify(initialUpdatePayload));
              this.lastBroadcast.set(subscriptionKey, { payload: initialUpdatePayload });
              console.log(
                `[WebSocket] 📡 Sent immediate candle_update to ${clientId} to prime subscribers`,
              );
            } catch (error) {
              console.error(
                `[WebSocket] ❌ Failed to send immediate candle_update to ${clientId}:`,
                error,
              );
            }
          }
        } else {
          console.warn(`[WebSocket] ⚠️ Socket closed before sending price data to ${clientId}`);
        }
      }
    } catch (error) {
      console.error('[WebSocket] ❌ Failed to send initial data:', error);
      console.error('[WebSocket] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        clientId,
        tokenAddress,
        timeframe,
        chartType,
      });
    }
  }

  /**
   * Broadcast graduation event to all subscribers of a token
   */
  private broadcastGraduationEvent(
    tokenAddress: string,
    graduationState: {
      isBonded: boolean;
      poolReady: boolean;
      poolAddress: string | null;
      dexLiveAt: Date | null;
    },
  ) {
    console.log(`📣 [WebSocket] Broadcasting graduation event for ${tokenAddress}`);

    const message = JSON.stringify({
      type: 'graduation_event',
      tokenAddress,
      graduationState,
      timestamp: Date.now(),
    });

    let broadcastCount = 0;

    // Find all subscription keys for this token (across all timeframes and chart types)
    for (const [subscriptionKey, subscribers] of this.subscriptions.entries()) {
      if (subscriptionKey.startsWith(`${tokenAddress}:`)) {
        for (const clientId of subscribers) {
          const client = this.clients.get(clientId);
          if (client && client.socket.readyState === 1) {
            try {
              client.socket.send(message);
              broadcastCount++;
            } catch (error) {
              console.error(
                `❌ [WebSocket] Failed to send graduation event to ${clientId}:`,
                error,
              );
            }
          }
        }
      }
    }

    console.log(`✅ [WebSocket] Graduation event sent to ${broadcastCount} clients`);
  }

  /**
   * Handle ACES price changes and broadcast to all active chart subscriptions
   */
  private handleAcesPriceUpdate(update: {
    price: number;
    timestamp: number;
    source: string;
    changePercent: number;
  }) {
    console.log(
      `[WebSocket] 💰 ACES price updated: $${update.price.toFixed(6)} (${update.source}, ${update.changePercent.toFixed(3)}%)`,
    );

    // Broadcast to ALL active subscriptions (both price and mcap charts)
    for (const [subscriptionKey, subscribers] of this.subscriptions.entries()) {
      if (subscribers.size === 0) continue;

      const [tokenAddress, timeframe, chartType] = subscriptionKey.split(':');

      // Get the last broadcast candle for this subscription
      const lastBroadcast = this.lastBroadcast.get(subscriptionKey);
      if (!lastBroadcast?.payload?.candle) {
        // No candle to update yet
        continue;
      }

      const message = JSON.stringify({
        type: 'aces_price_update',
        tokenAddress,
        timeframe,
        chartType,
        acesPrice: update.price,
        acesSource: update.source,
        changePercent: update.changePercent,
        timestamp: update.timestamp,
      });

      // Broadcast to all subscribers of this chart
      let broadcastCount = 0;
      for (const clientId of subscribers) {
        const client = this.clients.get(clientId);
        if (client && client.socket.readyState === 1) {
          try {
            client.socket.send(message);
            broadcastCount++;
          } catch (error) {
            console.error(`[WebSocket] Failed to send ACES update to ${clientId}:`, error);
          }
        }
      }

      if (broadcastCount > 0) {
        console.log(
          `[WebSocket] 📤 Broadcasted ACES update to ${broadcastCount} clients on ${subscriptionKey}`,
        );
      }
    }

    // Log tracker statistics periodically
    const stats = acesPriceTracker.getStats();
    console.log(
      `[AcesPriceTracker] 📊 Stats: ${stats.totalObservations} observations, ${stats.timeSpanHours.toFixed(1)}h span, ${stats.memoryEstimateKB.toFixed(2)}KB`,
    );
  }

  /**
   * Heartbeat to detect dead connections
   */
  private startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds

      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastPing > timeout) {
          console.log(`[WebSocket] Client ${clientId} timeout, disconnecting`);
          try {
            client.socket.close();
          } catch (error) {
            // Ignore
          }
          this.handleClientDisconnect(clientId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      pollingIntervals: this.pollingIntervals.size,
      subscriptionDetails: Array.from(this.subscriptions.entries()).map(([key, clients]) => ({
        subscription: key,
        clientCount: clients.size,
      })),
    };
  }
}
