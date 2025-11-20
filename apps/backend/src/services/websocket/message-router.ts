/**
 * Message Router
 * US-1.2: Route incoming messages to appropriate handlers
 *
 * Responsibilities:
 * - Route messages by topic/type
 * - Support wildcard patterns
 * - Priority queue for critical messages
 * - Dead letter queue for failed routes
 */

import { EventEmitter } from 'events';
import { MessageRoute, WebSocketMessage, MessageType } from '../../types/websocket';

interface PendingMessage {
  message: WebSocketMessage;
  clientId: string;
  priority: number;
  timestamp: number;
}

export class MessageRouter extends EventEmitter {
  private routes = new Map<string, MessageRoute>();
  private messageQueue: PendingMessage[] = [];
  private processingQueue = false;
  private deadLetterQueue: Array<{ message: WebSocketMessage; error: Error; timestamp: number }> =
    [];
  private readonly MAX_DEAD_LETTERS = 1000;
  private routingLatencies: number[] = [];

  constructor() {
    super();
  }

  /**
   * Register a route handler
   */
  registerRoute(route: MessageRoute): void {
    this.routes.set(route.topic, route);
    console.log(`[MessageRouter] ✅ Route registered: ${route.topic}`);
  }

  /**
   * Unregister a route
   */
  unregisterRoute(topic: string): void {
    this.routes.delete(topic);
    console.log(`[MessageRouter] ❌ Route unregistered: ${topic}`);
  }

  /**
   * Route a message to appropriate handler
   */
  async route(message: WebSocketMessage, clientId: string, priority: number = 5): Promise<void> {
    const startTime = Date.now();

    // Add to queue with priority
    this.messageQueue.push({
      message,
      clientId,
      priority,
      timestamp: startTime,
    });

    // Sort by priority (higher first) and timestamp (older first)
    this.messageQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Older first (FIFO within priority)
    });

    // Process queue
    if (!this.processingQueue) {
      await this.processQueue();
    }
  }

  /**
   * Process message queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    while (this.messageQueue.length > 0) {
      const pending = this.messageQueue.shift();
      if (!pending) break;

      try {
        await this.routeMessage(pending.message, pending.clientId);

        // Track latency
        const latency = Date.now() - pending.timestamp;
        this.routingLatencies.push(latency);
        if (this.routingLatencies.length > 1000) {
          this.routingLatencies.shift();
        }

        // Warn if latency is high
        if (latency > 5) {
          console.warn(
            `[MessageRouter] ⚠️  High routing latency: ${latency}ms for ${pending.message.type}`,
          );
        }
      } catch (error) {
        console.error('[MessageRouter] ❌ Error routing message:', error);
        this.addToDeadLetterQueue(pending.message, error as Error);
      }
    }

    this.processingQueue = false;
  }

  /**
   * Route individual message
   */
  private async routeMessage(message: WebSocketMessage, clientId: string): Promise<void> {
    // Determine topic from message
    const topic = this.extractTopic(message);

    if (!topic) {
      throw new Error(`Unable to extract topic from message type: ${message.type}`);
    }

    // Find matching route
    const route = this.findRoute(topic);

    if (!route) {
      throw new Error(`No route found for topic: ${topic}`);
    }

    // Execute handler
    try {
      await route.handler(message, clientId);
    } catch (error) {
      console.error(`[MessageRouter] Handler error for ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Extract topic from message
   */
  private extractTopic(message: WebSocketMessage): string | null {
    // For subscribe/unsubscribe, topic is explicit
    if ('topic' in message) {
      return (message as any).topic;
    }

    // For other messages, derive from type
    switch (message.type) {
      case MessageType.PING:
        return 'system.ping';
      case MessageType.DISCONNECT:
        return 'system.disconnect';
      default:
        return null;
    }
  }

  /**
   * Find matching route (supports wildcards)
   */
  private findRoute(topic: string): MessageRoute | undefined {
    // Exact match first
    if (this.routes.has(topic)) {
      return this.routes.get(topic);
    }

    // Wildcard matching: "chart.*" matches "chart.realtime"
    for (const [routeTopic, route] of this.routes.entries()) {
      if (this.matchesWildcard(topic, routeTopic)) {
        return route;
      }
    }

    return undefined;
  }

  /**
   * Check if topic matches wildcard pattern
   */
  private matchesWildcard(topic: string, pattern: string): boolean {
    if (!pattern.includes('*')) return false;

    // Convert pattern to regex
    // "chart.*.trades" -> "^chart\\..*\\.trades$"
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/^/, '^')
      .replace(/$/, '$');

    const regex = new RegExp(regexPattern);
    return regex.test(topic);
  }

  /**
   * Add message to dead letter queue
   */
  private addToDeadLetterQueue(message: WebSocketMessage, error: Error): void {
    this.deadLetterQueue.push({
      message,
      error,
      timestamp: Date.now(),
    });

    // Limit queue size
    if (this.deadLetterQueue.length > this.MAX_DEAD_LETTERS) {
      this.deadLetterQueue.shift();
    }

    // Emit event for monitoring
    this.emit('dead_letter', { message, error });
  }

  /**
   * Get routing statistics
   */
  getStats() {
    const avgLatency =
      this.routingLatencies.length > 0
        ? this.routingLatencies.reduce((a, b) => a + b, 0) / this.routingLatencies.length
        : 0;

    const p99Latency =
      this.routingLatencies.length > 0
        ? this.routingLatencies[Math.floor(this.routingLatencies.length * 0.99)]
        : 0;

    return {
      registeredRoutes: this.routes.size,
      queuedMessages: this.messageQueue.length,
      deadLetters: this.deadLetterQueue.length,
      avgLatencyMs: Math.round(avgLatency * 100) / 100,
      p99LatencyMs: Math.round(p99Latency * 100) / 100,
      routes: Array.from(this.routes.keys()),
    };
  }

  /**
   * Get dead letter queue for inspection
   */
  getDeadLetters() {
    return this.deadLetterQueue;
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetters(): void {
    this.deadLetterQueue = [];
  }
}

