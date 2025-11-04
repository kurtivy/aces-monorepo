/**
 * Subscription Manager
 * US-1.3: Manage client subscriptions to topics
 *
 * Responsibilities:
 * - Track which clients are subscribed to which topics
 * - Prevent duplicate subscriptions
 * - Auto-cleanup on client disconnect
 * - Enforce subscription limits per client
 */

import { EventEmitter } from 'events';
import { SubscriptionInfo } from '../../types/websocket';

export class SubscriptionManager extends EventEmitter {
  private subscriptions = new Map<string, SubscriptionInfo>();
  private clientSubscriptions = new Map<string, Set<string>>(); // clientId -> Set<subscriptionKey>
  private readonly MAX_SUBSCRIPTIONS_PER_CLIENT = 100;

  constructor() {
    super();
  }

  /**
   * Subscribe a client to a topic
   */
  subscribe(clientId: string, topic: string, params: Record<string, any> = {}): string {
    // Generate subscription key
    const key = this.buildSubscriptionKey(topic, params);

    // Check client subscription limit
    const clientSubs = this.clientSubscriptions.get(clientId) || new Set();
    if (clientSubs.size >= this.MAX_SUBSCRIPTIONS_PER_CLIENT) {
      throw new Error(
        `Client ${clientId} has reached max subscriptions (${this.MAX_SUBSCRIPTIONS_PER_CLIENT})`,
      );
    }

    // Get or create subscription
    let subscription = this.subscriptions.get(key);
    const isNewSubscription = !subscription;

    if (!subscription) {
      subscription = {
        key,
        topic,
        params,
        clients: new Set([clientId]),
        createdAt: Date.now(),
        lastUpdateAt: null,
        messageCount: 0,
      };
      this.subscriptions.set(key, subscription);
      console.log(`[SubscriptionManager] 🆕 New subscription created: ${key}`);
    } else {
      subscription.clients.add(clientId);
      console.log(`[SubscriptionManager] ♻️  Client added to existing subscription: ${key}`);
    }

    // Track client subscriptions
    if (!this.clientSubscriptions.has(clientId)) {
      this.clientSubscriptions.set(clientId, new Set());
    }
    this.clientSubscriptions.get(clientId)!.add(key);

    // Emit event for new subscriptions (triggers external data source subscription)
    if (isNewSubscription) {
      this.emit('subscription_created', { key, topic, params });
    }

    console.log(
      `[SubscriptionManager] 📊 Subscription stats: ${subscription.clients.size} clients on ${key}`,
    );

    return key;
  }

  /**
   * Unsubscribe a client from a topic
   */
  unsubscribe(clientId: string, topic: string, params: Record<string, any> = {}): void {
    const key = this.buildSubscriptionKey(topic, params);
    const subscription = this.subscriptions.get(key);

    if (!subscription) {
      console.warn(`[SubscriptionManager] ⚠️  Subscription not found: ${key}`);
      return;
    }

    // Remove client from subscription
    subscription.clients.delete(clientId);
    console.log(`[SubscriptionManager] Client ${clientId} unsubscribed from ${key}`);

    // Remove from client subscriptions
    const clientSubs = this.clientSubscriptions.get(clientId);
    if (clientSubs) {
      clientSubs.delete(key);
      if (clientSubs.size === 0) {
        this.clientSubscriptions.delete(clientId);
      }
    }

    // If no more clients, clean up subscription
    if (subscription.clients.size === 0) {
      this.subscriptions.delete(key);
      console.log(`[SubscriptionManager] 🗑️  Subscription removed (no clients): ${key}`);
      this.emit('subscription_removed', { key, topic, params });
    }
  }

  /**
   * Unsubscribe client from all topics (called on disconnect)
   */
  unsubscribeAll(clientId: string): void {
    const clientSubs = this.clientSubscriptions.get(clientId);
    if (!clientSubs) return;

    console.log(`[SubscriptionManager] Unsubscribing client ${clientId} from all topics`);

    // Unsubscribe from each subscription
    Array.from(clientSubs).forEach((key) => {
      const subscription = this.subscriptions.get(key);
      if (subscription) {
        subscription.clients.delete(clientId);

        // Clean up if no clients left
        if (subscription.clients.size === 0) {
          this.subscriptions.delete(key);
          console.log(`[SubscriptionManager] 🗑️  Subscription removed: ${key}`);
          this.emit('subscription_removed', {
            key,
            topic: subscription.topic,
            params: subscription.params,
          });
        }
      }
    });

    // Clear client subscriptions
    this.clientSubscriptions.delete(clientId);
  }

  /**
   * Get all clients subscribed to a topic
   */
  getSubscribers(topic: string, params: Record<string, any> = {}): Set<string> {
    const key = this.buildSubscriptionKey(topic, params);
    const subscription = this.subscriptions.get(key);
    return subscription ? new Set(subscription.clients) : new Set();
  }

  /**
   * Check if a client has a subscription
   */
  hasSubscription(clientId: string, topic: string, params: Record<string, any> = {}): boolean {
    const key = this.buildSubscriptionKey(topic, params);
    const clientSubs = this.clientSubscriptions.get(clientId);
    return clientSubs ? clientSubs.has(key) : false;
  }

  /**
   * Get subscription count for a client
   */
  getSubscriptionCount(clientId: string): number {
    const clientSubs = this.clientSubscriptions.get(clientId);
    return clientSubs ? clientSubs.size : 0;
  }

  /**
   * Get all subscriptions (for stats/debugging)
   */
  getAllSubscriptions(): SubscriptionInfo[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription by key
   */
  getSubscription(key: string): SubscriptionInfo | undefined {
    return this.subscriptions.get(key);
  }

  /**
   * Update subscription metadata (called when data is broadcasted)
   */
  updateSubscriptionMetadata(key: string): void {
    const subscription = this.subscriptions.get(key);
    if (subscription) {
      subscription.lastUpdateAt = Date.now();
      subscription.messageCount++;
    }
  }

  /**
   * Build unique subscription key from topic + params
   */
  private buildSubscriptionKey(topic: string, params: Record<string, any>): string {
    // Sort params for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    return sortedParams ? `${topic}:${sortedParams}` : topic;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      totalClients: this.clientSubscriptions.size,
      subscriptions: Array.from(this.subscriptions.values()).map((sub) => ({
        key: sub.key,
        topic: sub.topic,
        clientCount: sub.clients.size,
        messageCount: sub.messageCount,
        lastUpdate: sub.lastUpdateAt,
        uptimeMs: Date.now() - sub.createdAt,
      })),
    };
  }
}

