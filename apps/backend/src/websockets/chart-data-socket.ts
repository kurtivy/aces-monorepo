import { FastifyInstance } from 'fastify';
import { UnifiedChartDataService } from '../services/unified-chart-data-service';

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
  process.env.BITQUERY_REALTIME_POLL_INTERVAL_MS || process.env.BITQUERY_POLL_INTERVAL_MS || 2500, // 2.5 seconds - matches trade history polling
);

export class ChartDataWebSocket {
  private clients = new Map<string, WebSocketClient>();
  private subscriptions = new Map<string, Set<string>>(); // "tokenAddress:timeframe:chartType" -> Set<clientId>
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private readonly pollIntervalMs: number;

  constructor(
    private fastify: FastifyInstance,
    private unifiedService: UnifiedChartDataService,
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

    console.log('✅ WebSocket server initialized on /ws/chart');
  }

  /**
   * Handle client messages (subscribe/unsubscribe)
   */
  private handleClientMessage(clientId: string, data: { type: string; [key: string]: unknown }) {
    const client = this.clients.get(clientId);
    if (!client) return;

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

    console.log(`[WebSocket] Client ${clientId} subscribed to ${subscriptionKey}`);

    // Start polling if this is first subscriber
    if (this.subscriptions.get(subscriptionKey)!.size === 1) {
      this.startPolling(tokenAddress.toLowerCase(), timeframe, chartType);
    }

    // Send immediate update
    this.sendUpdate(clientId, tokenAddress.toLowerCase(), timeframe, chartType);
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
      console.log(`⏰ [WebSocket] Interval tick for ${subscriptionKey}`);
      if (chartType === 'mcap') {
        await this.pollAndBroadcastMarketCap(tokenAddress, timeframe);
      } else {
        await this.pollAndBroadcast(tokenAddress, timeframe);
      }
    }, this.pollIntervalMs);

    this.pollingIntervals.set(subscriptionKey, interval);
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
      console.log(`[WebSocket] Stopped polling for ${subscriptionKey}`);
    }
  }

  /**
   * Poll data and broadcast to subscribers (PRICE chart)
   */
  private async pollAndBroadcast(tokenAddress: string, timeframe: string) {
    try {
      console.log(`🔄 [WebSocket] Polling PRICE ${tokenAddress} ${timeframe}...`);

      const subscriptionKey = `${tokenAddress}:${timeframe}:price`;
      const subscribers = this.subscriptions.get(subscriptionKey);

      // Defensive cleanup: if no subscribers, stop polling immediately
      if (!subscribers || subscribers.size === 0) {
        console.warn(`⚠️ [WebSocket] No subscribers for ${subscriptionKey}, stopping polling`);
        this.stopPolling(subscriptionKey);
        this.subscriptions.delete(subscriptionKey);
        return;
      }

      const candle = await this.unifiedService.getLatestCandle(tokenAddress, timeframe);

      if (!candle) {
        console.warn(`⚠️ [WebSocket] No candle returned for ${tokenAddress} ${timeframe}`);
        return;
      }

      console.log(`✅ [WebSocket] Got candle for ${tokenAddress} ${timeframe}:`, {
        timestamp: candle.timestamp,
        close: candle.close,
        closeUsd: candle.closeUsd,
      });

      const message = JSON.stringify({
        type: 'candle_update',
        tokenAddress,
        timeframe,
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
    } catch (error) {
      console.error('❌ [WebSocket] Poll error:', error);
      console.error('Stack trace:', error);
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

      // Get latest price candle
      const candle = await this.unifiedService.getLatestCandle(tokenAddress, timeframe);

      if (!candle) {
        console.warn(`⚠️ [WebSocket] No candle returned for ${tokenAddress} ${timeframe}`);
        return;
      }

      // Get graduation state to determine supply
      const chartData = await this.unifiedService.getChartData(tokenAddress, {
        timeframe,
        limit: 1,
        includeUsd: true,
      });

      const supply = chartData.graduationState?.poolReady
        ? parseFloat(candle.circulatingSupply || '0') // DEX: use actual circulating supply
        : 800000000; // Bonding curve: fixed 800 million tokens

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
        supplySource: chartData.graduationState?.poolReady
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
    if (!client) return;

    try {
      const chartData = await this.unifiedService.getChartData(tokenAddress, {
        timeframe,
        limit: 100, // Send last 100 candles on subscribe
        includeUsd: true,
      });

      if (chartType === 'mcap') {
        // Calculate market cap candles
        const supply = chartData.graduationState?.poolReady ? null : 800000000; // Fixed 800M for bonding curve

        const mcapCandles = chartData.candles.map((c) => {
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

        client.socket.send(message);
      } else {
        // Send price candles (existing behavior)
        const message = JSON.stringify({
          type: 'initial_data',
          tokenAddress,
          timeframe,
          chartType: 'price',
          candles: chartData.candles.map((c) => ({
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

        client.socket.send(message);
      }
    } catch (error) {
      console.error('[WebSocket] Failed to send initial data:', error);
    }
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
