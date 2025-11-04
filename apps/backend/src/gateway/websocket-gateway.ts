/**
 * WebSocket Gateway
 * US-1.1: Central WebSocket server and coordinator
 *
 * This is the main entry point for all WebSocket connections.
 * Coordinates between all Phase 1 services:
 * - Connection State Manager
 * - Subscription Manager
 * - Message Router
 * - Subscription Deduplicator
 * - Rate Limit Monitor
 */

import { FastifyInstance } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import {
  WebSocketClient,
  MessageType,
  WebSocketMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  GatewayStats,
} from '../types/websocket';
import { ConnectionStateManager } from '../services/websocket/connection-state-manager';
import { SubscriptionManager } from '../services/websocket/subscription-manager';
import { MessageRouter } from '../services/websocket/message-router';
import { SubscriptionDeduplicator } from '../services/websocket/subscription-deduplicator';
import { RateLimitMonitor } from '../services/websocket/rate-limit-monitor';

export class WebSocketGateway {
  private static instance: WebSocketGateway | null = null;

  // Phase 1 services
  private connectionManager: ConnectionStateManager;
  private subscriptionManager: SubscriptionManager;
  private messageRouter: MessageRouter;
  private deduplicator: SubscriptionDeduplicator;
  private rateLimitMonitor: RateLimitMonitor;

  // Stats
  private startTime: number = Date.now();
  private totalMessagesReceived = 0;
  private totalMessagesSent = 0;

  private constructor(private fastify: FastifyInstance) {
    // Initialize Phase 1 services
    this.connectionManager = new ConnectionStateManager();
    this.subscriptionManager = new SubscriptionManager();
    this.messageRouter = new MessageRouter();
    this.deduplicator = new SubscriptionDeduplicator();
    this.rateLimitMonitor = new RateLimitMonitor();

    // Wire up event handlers
    this.setupEventHandlers();

    // Register default routes
    this.registerDefaultRoutes();
  }

  /**
   * Singleton pattern - only one gateway instance
   */
  static getInstance(fastify?: FastifyInstance): WebSocketGateway {
    if (!WebSocketGateway.instance) {
      if (!fastify) {
        throw new Error('Fastify instance required for first initialization');
      }
      WebSocketGateway.instance = new WebSocketGateway(fastify);
    }
    return WebSocketGateway.instance;
  }

  /**
   * Initialize the WebSocket gateway
   */
  async initialize(): Promise<void> {
    console.log('========================================');
    console.log('🚀 WebSocket Gateway - Phase 1');
    console.log('========================================');

    // Register WebSocket route
    this.fastify.get('/ws/gateway', { websocket: true } as any, (socket: SocketStream, req) => {
      this.handleConnection(socket, req);
    });

    // Start heartbeat monitoring
    this.connectionManager.startHeartbeat();

    console.log('✅ WebSocket Gateway initialized on /ws/gateway');
    console.log('========================================\n');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: SocketStream, req: any): void {
    const clientId = this.generateClientId();

    console.log(`[Gateway] 🔌 New connection: ${clientId}`);

    // Create client object
    const client: WebSocketClient = {
      id: clientId,
      socket,
      subscriptions: new Set(),
      connectedAt: Date.now(),
      lastPingAt: Date.now(),
      lastPongAt: Date.now(),
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    };

    // Register with connection manager
    this.connectionManager.registerClient(client);

    // Send welcome message
    this.sendToClient(clientId, {
      type: MessageType.CONNECTED,
      clientId,
      timestamp: Date.now(),
    });

    // Handle incoming messages
    socket.on('message', (rawMessage: Buffer) => {
      this.handleMessage(clientId, rawMessage);
    });

    // Handle disconnection
    socket.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[Gateway] Socket error for ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(clientId: string, rawMessage: Buffer): Promise<void> {
    this.totalMessagesReceived++;

    try {
      const message: WebSocketMessage = JSON.parse(rawMessage.toString());

      console.log(`[Gateway] 📨 Message from ${clientId}:`, message.type);

      // Route message based on type
      switch (message.type) {
        case MessageType.SUBSCRIBE:
          await this.handleSubscribe(clientId, message as SubscribeMessage);
          break;

        case MessageType.UNSUBSCRIBE:
          await this.handleUnsubscribe(clientId, message as UnsubscribeMessage);
          break;

        case MessageType.PING:
          this.handlePing(clientId);
          break;

        case MessageType.PONG:
          this.handlePong(clientId);
          break;

        default:
          // Route to message router for custom handlers
          await this.messageRouter.route(message, clientId);
          break;
      }
    } catch (error) {
      console.error(`[Gateway] Error handling message from ${clientId}:`, error);
      this.sendError(clientId, 'INVALID_MESSAGE', 'Failed to process message');
    }
  }

  /**
   * Handle subscribe request
   */
  private async handleSubscribe(clientId: string, message: SubscribeMessage): Promise<void> {
    const { topic, params } = message;

    console.log(`[Gateway] 📥 Subscribe request: ${clientId} -> ${topic}`);

    try {
      // Subscribe in subscription manager (tracks client subscriptions)
      const subKey = this.subscriptionManager.subscribe(clientId, topic, params);

      // Subscribe in deduplicator (manages external API subscriptions)
      // Determine data source from topic
      const dataSource = this.getDataSourceFromTopic(topic);
      this.deduplicator.subscribe(clientId, topic, params, dataSource);

      // Send success confirmation
      this.sendToClient(clientId, {
        type: MessageType.SUBSCRIPTION_SUCCESS,
        topic,
        params,
        subscriptionKey: subKey,
        timestamp: Date.now(),
      });

      console.log(`[Gateway] ✅ Subscription successful: ${subKey}`);
    } catch (error) {
      console.error(`[Gateway] ❌ Subscribe error:`, error);
      this.sendError(clientId, 'SUBSCRIBE_FAILED', (error as Error).message);
    }
  }

  /**
   * Handle unsubscribe request
   */
  private async handleUnsubscribe(clientId: string, message: UnsubscribeMessage): Promise<void> {
    const { topic, params } = message;

    console.log(`[Gateway] 📤 Unsubscribe request: ${clientId} -> ${topic}`);

    try {
      this.subscriptionManager.unsubscribe(clientId, topic, params);
      this.deduplicator.unsubscribe(clientId, topic, params);

      console.log(`[Gateway] ✅ Unsubscribed: ${topic}`);
    } catch (error) {
      console.error(`[Gateway] ❌ Unsubscribe error:`, error);
    }
  }

  /**
   * Handle ping from client
   */
  private handlePing(clientId: string): void {
    this.sendToClient(clientId, {
      type: MessageType.PONG,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle pong from client
   */
  private handlePong(clientId: string): void {
    this.connectionManager.recordPong(clientId);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    console.log(`[Gateway] 🔌 Disconnected: ${clientId}`);

    // Unsubscribe from all topics
    this.subscriptionManager.unsubscribeAll(clientId);
    this.deduplicator.unsubscribeAll(clientId);

    // Unregister from connection manager
    this.connectionManager.unregisterClient(clientId);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: any): void {
    const client = this.connectionManager.getClient(clientId);

    if (!client) {
      console.warn(`[Gateway] ⚠️  Client not found: ${clientId}`);
      return;
    }

    try {
      client.socket.socket.send(JSON.stringify(message));
      this.totalMessagesSent++;
    } catch (error) {
      console.error(`[Gateway] Error sending to ${clientId}:`, error);
    }
  }

  /**
   * Broadcast message to multiple clients
   */
  broadcast(clientIds: string[], message: any): number {
    let sentCount = 0;

    clientIds.forEach((clientId) => {
      try {
        this.sendToClient(clientId, message);
        sentCount++;
      } catch (error) {
        console.error(`[Gateway] Broadcast error to ${clientId}:`, error);
      }
    });

    return sentCount;
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, code: string, message: string): void {
    this.sendToClient(clientId, {
      type: MessageType.ERROR,
      error: {
        code,
        message,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Setup event handlers between services
   */
  private setupEventHandlers(): void {
    // When external subscription is created, track in rate limit monitor
    this.deduplicator.on('external_subscribe', ({ dataSource }) => {
      this.rateLimitMonitor.recordRequest(dataSource);
    });

    // When data needs to be broadcasted to clients
    this.deduplicator.on('broadcast_to_clients', ({ clients, data, topic }) => {
      const message = {
        type: MessageType.DATA_UPDATE,
        topic,
        data,
        timestamp: Date.now(),
      };

      this.broadcast(clients, message);
    });

    // When zombie connection detected
    this.connectionManager.on('zombie_detected', ({ clientId }) => {
      console.log(`[Gateway] 💀 Cleaning up zombie connection: ${clientId}`);
      this.handleDisconnection(clientId);
    });

    // Rate limit alerts
    this.rateLimitMonitor.on('rate_limit_alert', (alert) => {
      console.error(`[Gateway] 🚨 RATE LIMIT ALERT:`, alert);
      // Could integrate with alerting service here
    });
  }

  /**
   * Register default message routes
   */
  private registerDefaultRoutes(): void {
    // System ping route
    this.messageRouter.registerRoute({
      topic: 'system.ping',
      handler: (message, clientId) => {
        this.handlePing(clientId);
      },
      priority: 10, // High priority
    });

    // System disconnect route
    this.messageRouter.registerRoute({
      topic: 'system.disconnect',
      handler: (message, clientId) => {
        this.handleDisconnection(clientId);
      },
      priority: 10,
    });
  }

  /**
   * Determine data source from topic
   */
  private getDataSourceFromTopic(topic: string): string {
    if (topic.startsWith('chart.')) return 'bitquery';
    if (topic.startsWith('trade.')) return 'goldsky';
    if (topic.startsWith('pool.')) return 'quicknode';
    if (topic.startsWith('quote.')) return 'quicknode';
    return 'unknown';
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get gateway statistics
   */
  getStats(): GatewayStats {
    const connStats = this.connectionManager.getStats();
    const subStats = this.subscriptionManager.getStats();
    const dedupStats = this.deduplicator.getDetailedStats();
    const rateLimitStats = this.rateLimitMonitor.getStats();
    const routerStats = this.messageRouter.getStats();

    return {
      connectedClients: connStats.totalClients,
      activeSubscriptions: subStats.totalSubscriptions,
      totalMessagesReceived: this.totalMessagesReceived,
      totalMessagesSent: this.totalMessagesSent,
      uptimeMs: Date.now() - this.startTime,
      subscriptions: subStats.subscriptions,
      deduplication: dedupStats,
      rateLimits: rateLimitStats.usage,
      router: routerStats,
      connection: connStats,
    };
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    console.log('[Gateway] 🛑 Shutting down...');

    this.connectionManager.stopHeartbeat();

    // Disconnect all clients
    const clients = this.connectionManager.getAllClients();
    clients.forEach((client) => {
      try {
        client.socket.socket.close();
      } catch (error) {
        // Ignore
      }
    });

    console.log('[Gateway] ✅ Shutdown complete');
  }

  /**
   * Public getters for services (for testing/debugging)
   */
  getConnectionManager() {
    return this.connectionManager;
  }

  getSubscriptionManager() {
    return this.subscriptionManager;
  }

  getDeduplicator() {
    return this.deduplicator;
  }

  getRateLimitMonitor() {
    return this.rateLimitMonitor;
  }

  getMessageRouter() {
    return this.messageRouter;
  }
}

