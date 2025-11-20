/**
 * Subscription Deduplicator
 * US-8.1: Prevent rate limits by deduplicating external API subscriptions
 *
 * KEY FEATURE: 1000 clients watching same token = 1 external API subscription
 *
 * Responsibilities:
 * - Track external subscriptions separately from client subscriptions
 * - Create external subscription only on first client request
 * - Broadcast external data to all subscribed clients
 * - Close external subscription when last client unsubscribes
 * - Provide deduplication ratio metrics
 */

import { EventEmitter } from 'events';

interface ExternalSubscription {
  key: string;
  topic: string;
  params: Record<string, any>;
  clients: Set<string>; // Client IDs
  externalRef: any; // Reference to external subscription (adapter-specific)
  createdAt: number;
  lastDataAt: number | null;
  messageCount: number;
  dataSource: string; // e.g., "goldsky", "bitquery", "quicknode"
}

export class SubscriptionDeduplicator extends EventEmitter {
  private externalSubscriptions = new Map<string, ExternalSubscription>();
  private clientToSubscriptions = new Map<string, Set<string>>(); // clientId -> Set<subscriptionKey>

  constructor() {
    super();
  }

  /**
   * Subscribe a client to a topic
   * Returns: subscription key
   */
  subscribe(
    clientId: string,
    topic: string,
    params: Record<string, any>,
    dataSource: string,
  ): string {
    const key = this.buildKey(topic, params);

    // Get or create external subscription
    let subscription = this.externalSubscriptions.get(key);
    const isNewSubscription = !subscription;

    if (!subscription) {
      // First client - create external subscription
      console.log(`[Deduplicator] 🆕 Creating NEW external subscription: ${key}`);

      subscription = {
        key,
        topic,
        params,
        clients: new Set([clientId]),
        externalRef: null, // Will be set by adapter
        createdAt: Date.now(),
        lastDataAt: null,
        messageCount: 0,
        dataSource,
      };

      this.externalSubscriptions.set(key, subscription);

      // Emit event for external adapter to subscribe
      this.emit('external_subscribe', { key, topic, params, dataSource });
    } else {
      // Additional client - reuse existing subscription
      console.log(`[Deduplicator] ♻️  Reusing existing external subscription: ${key}`);
      subscription.clients.add(clientId);
    }

    // Track client subscriptions
    if (!this.clientToSubscriptions.has(clientId)) {
      this.clientToSubscriptions.set(clientId, new Set());
    }
    this.clientToSubscriptions.get(clientId)!.add(key);

    console.log(
      `[Deduplicator] 📊 ${subscription.clients.size} clients subscribed to ${key} (${dataSource})`,
    );

    return key;
  }

  /**
   * Unsubscribe a client from a topic
   */
  unsubscribe(clientId: string, topic: string, params: Record<string, any>): void {
    const key = this.buildKey(topic, params);
    const subscription = this.externalSubscriptions.get(key);

    if (!subscription) {
      console.warn(`[Deduplicator] ⚠️  Subscription not found: ${key}`);
      return;
    }

    // Remove client
    subscription.clients.delete(clientId);
    console.log(`[Deduplicator] Client ${clientId} unsubscribed from ${key}`);

    // Remove from client tracking
    const clientSubs = this.clientToSubscriptions.get(clientId);
    if (clientSubs) {
      clientSubs.delete(key);
      if (clientSubs.size === 0) {
        this.clientToSubscriptions.delete(clientId);
      }
    }

    // If no more clients, close external subscription
    if (subscription.clients.size === 0) {
      console.log(`[Deduplicator] 🗑️  No more clients, closing external subscription: ${key}`);
      this.emit('external_unsubscribe', {
        key,
        topic: subscription.topic,
        params: subscription.params,
        externalRef: subscription.externalRef,
        dataSource: subscription.dataSource,
      });
      this.externalSubscriptions.delete(key);
    }
  }

  /**
   * Unsubscribe client from all topics (on disconnect)
   */
  unsubscribeAll(clientId: string): void {
    const clientSubs = this.clientToSubscriptions.get(clientId);
    if (!clientSubs) return;

    console.log(`[Deduplicator] Unsubscribing ${clientId} from ${clientSubs.size} topics`);

    Array.from(clientSubs).forEach((key) => {
      const subscription = this.externalSubscriptions.get(key);
      if (subscription) {
        subscription.clients.delete(clientId);

        if (subscription.clients.size === 0) {
          console.log(`[Deduplicator] 🗑️  Closing external subscription: ${key}`);
          this.emit('external_unsubscribe', {
            key,
            topic: subscription.topic,
            params: subscription.params,
            externalRef: subscription.externalRef,
            dataSource: subscription.dataSource,
          });
          this.externalSubscriptions.delete(key);
        }
      }
    });

    this.clientToSubscriptions.delete(clientId);
  }

  /**
   * Broadcast data from external source to all subscribed clients
   * Called when external adapter receives data
   */
  broadcast(key: string, data: any): number {
    const subscription = this.externalSubscriptions.get(key);

    if (!subscription) {
      console.warn(`[Deduplicator] ⚠️  Subscription not found for broadcast: ${key}`);
      return 0;
    }

    subscription.lastDataAt = Date.now();
    subscription.messageCount++;

    const clientCount = subscription.clients.size;
    console.log(`[Deduplicator] 📡 Broadcasting to ${clientCount} clients: ${key}`);

    // Emit event for gateway to broadcast to clients
    this.emit('broadcast_to_clients', {
      key,
      topic: subscription.topic,
      params: subscription.params,
      clients: Array.from(subscription.clients),
      data,
    });

    return clientCount;
  }

  /**
   * Set external subscription reference (set by adapter after subscribing)
   */
  setExternalRef(key: string, externalRef: any): void {
    const subscription = this.externalSubscriptions.get(key);
    if (subscription) {
      subscription.externalRef = externalRef;
    }
  }

  /**
   * Get subscribers for a subscription key
   */
  getSubscribers(key: string): string[] {
    const subscription = this.externalSubscriptions.get(key);
    return subscription ? Array.from(subscription.clients) : [];
  }

  /**
   * Build subscription key from topic + params
   */
  private buildKey(topic: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    return sortedParams ? `${topic}:${sortedParams}` : topic;
  }

  /**
   * Get deduplication statistics
   */
  getStats() {
    const totalClients = Array.from(this.externalSubscriptions.values()).reduce(
      (sum, sub) => sum + sub.clients.size,
      0,
    );

    const externalCount = this.externalSubscriptions.size;
    const dedupRatio = externalCount > 0 ? totalClients / externalCount : 0;

    // Group by data source
    const byDataSource: Record<string, { subscriptions: number; clients: number }> = {};
    this.externalSubscriptions.forEach((sub) => {
      if (!byDataSource[sub.dataSource]) {
        byDataSource[sub.dataSource] = { subscriptions: 0, clients: 0 };
      }
      byDataSource[sub.dataSource].subscriptions++;
      byDataSource[sub.dataSource].clients += sub.clients.size;
    });

    return {
      externalSubscriptions: externalCount,
      totalClients,
      dedupRatio: Math.round(dedupRatio * 10) / 10,
      byDataSource,
      subscriptions: Array.from(this.externalSubscriptions.values()).map((sub) => ({
        key: sub.key,
        topic: sub.topic,
        dataSource: sub.dataSource,
        clients: sub.clients.size,
        messageCount: sub.messageCount,
        lastData: sub.lastDataAt ? Date.now() - sub.lastDataAt : null,
        uptimeMs: Date.now() - sub.createdAt,
      })),
    };
  }

  /**
   * Get detailed stats for monitoring
   */
  getDetailedStats() {
    const stats = this.getStats();

    // Calculate savings
    const potentialRequests = stats.totalClients;
    const actualRequests = stats.externalSubscriptions;
    const savedRequests = potentialRequests - actualRequests;
    const savingsPercentage =
      potentialRequests > 0 ? (savedRequests / potentialRequests) * 100 : 0;

    return {
      ...stats,
      savings: {
        potentialRequests, // Without deduplication
        actualRequests, // With deduplication
        savedRequests,
        savingsPercentage: Math.round(savingsPercentage * 10) / 10,
      },
    };
  }
}

