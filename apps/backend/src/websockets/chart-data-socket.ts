import { FastifyInstance } from 'fastify';
import { UnifiedChartDataService } from '../services/unified-chart-data-service';

interface WebSocketClient {
  id: string;
  socket: any; // Fastify WebSocket socket
  subscriptions: Set<string>; // Set of "tokenAddress:timeframe"
  lastPing: number;
}

export class ChartDataWebSocket {
  private clients = new Map<string, WebSocketClient>();
  private subscriptions = new Map<string, Set<string>>(); // "tokenAddress:timeframe" -> Set<clientId>
  private pollingIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private fastify: FastifyInstance,
    private unifiedService: UnifiedChartDataService,
  ) {}

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
        this.subscribe(clientId, data.tokenAddress as string, data.timeframe as string);
        break;

      case 'unsubscribe':
        this.unsubscribe(clientId, data.tokenAddress as string, data.timeframe as string);
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
  private subscribe(clientId: string, tokenAddress: string, timeframe: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const subscriptionKey = `${tokenAddress.toLowerCase()}:${timeframe}`;

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
      this.startPolling(tokenAddress.toLowerCase(), timeframe);
    }

    // Send immediate update
    this.sendUpdate(clientId, tokenAddress.toLowerCase(), timeframe);
  }

  /**
   * Unsubscribe client from token updates
   */
  private unsubscribe(clientId: string, tokenAddress: string, timeframe: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const subscriptionKey = `${tokenAddress.toLowerCase()}:${timeframe}`;

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
  private startPolling(tokenAddress: string, timeframe: string) {
    const subscriptionKey = `${tokenAddress}:${timeframe}`;

    if (this.pollingIntervals.has(subscriptionKey)) {
      console.log(`⚠️ [WebSocket] Already polling ${subscriptionKey}`);
      return; // Already polling
    }

    console.log(`🚀 [WebSocket] Starting polling for ${subscriptionKey} (every 2.5s)`);

    // Poll every 2.5 seconds (backend) - users see updates every 5s due to cache
    const interval = setInterval(async () => {
      console.log(`⏰ [WebSocket] Interval tick for ${subscriptionKey}`);
      await this.pollAndBroadcast(tokenAddress, timeframe);
    }, 2500);

    this.pollingIntervals.set(subscriptionKey, interval);
    console.log(`✅ [WebSocket] Interval set, ID:`, interval);

    // Do initial poll immediately
    console.log(`📍 [WebSocket] Doing initial poll for ${subscriptionKey}`);
    this.pollAndBroadcast(tokenAddress, timeframe);
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
   * Poll data and broadcast to subscribers
   */
  private async pollAndBroadcast(tokenAddress: string, timeframe: string) {
    try {
      console.log(`🔄 [WebSocket] Polling ${tokenAddress} ${timeframe}...`);
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

      const subscriptionKey = `${tokenAddress}:${timeframe}`;
      const subscribers = this.subscriptions.get(subscriptionKey);

      if (!subscribers || subscribers.size === 0) {
        console.warn(`⚠️ [WebSocket] No subscribers for ${subscriptionKey}`);
        return;
      }

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
   * Send immediate update to specific client
   */
  private async sendUpdate(clientId: string, tokenAddress: string, timeframe: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const chartData = await this.unifiedService.getChartData(tokenAddress, {
        timeframe,
        limit: 100, // Send last 100 candles on subscribe
        includeUsd: true,
      });

      const message = JSON.stringify({
        type: 'initial_data',
        tokenAddress,
        timeframe,
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
