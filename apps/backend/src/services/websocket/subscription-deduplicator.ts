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
import * as Sentry from '@sentry/node';

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

interface DedupTelemetryOptions {
  intervalMs: number;
  staleThresholdMs: number;
  sentryEnabled: boolean;
  sentryThrottleMs: number;
  minHealthyRatio: number;
  logHealthySamples: boolean;
}

interface DedupTelemetrySnapshot {
  reason: string;
  timestamp: string;
  totalClients: number;
  externalSubscriptions: number;
  dedupRatio: number;
  savingsPercentage: number;
  bitquerySubscriptions: number;
  bitqueryClients: number;
  staleBitQueryCount: number;
  staleBitQuerySubscriptions: Array<{
    key: string;
    clients: number;
    lastDataMsAgo: number;
    uptimeMs: number;
  }>;
  busiestSubscriptions: Array<{
    key: string;
    clients: number;
    dataSource: string;
  }>;
}

export class SubscriptionDeduplicator extends EventEmitter {
  private externalSubscriptions = new Map<string, ExternalSubscription>();
  private clientToSubscriptions = new Map<string, Set<string>>(); // clientId -> Set<subscriptionKey>
  private telemetryOptions: DedupTelemetryOptions | null = null;
  private telemetryTimer: NodeJS.Timeout | null = null;
  private lastTelemetrySentryAt = 0;

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
      dataSource: subscription.dataSource,
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
    const savingsPercentage = potentialRequests > 0 ? (savedRequests / potentialRequests) * 100 : 0;

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

  startTelemetry(options: Partial<DedupTelemetryOptions> = {}): void {
    const defaults: DedupTelemetryOptions = {
      intervalMs: 5 * 60 * 1000,
      staleThresholdMs: 45 * 1000,
      sentryEnabled: false,
      sentryThrottleMs: 5 * 60 * 1000,
      minHealthyRatio: 5,
      logHealthySamples: true,
    };

    this.telemetryOptions = { ...defaults, ...options };

    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }

    if (this.telemetryOptions.intervalMs > 0) {
      this.telemetryTimer = setInterval(
        () => this.emitTelemetrySnapshot('interval'),
        this.telemetryOptions.intervalMs,
      );
      console.log(
        `[Deduplicator] 📈 Telemetry loop enabled (interval=${this.telemetryOptions.intervalMs}ms, Sentry=${
          this.telemetryOptions.sentryEnabled ? 'ON' : 'OFF'
        })`,
      );
    } else {
      console.log('[Deduplicator] 📉 Telemetry loop disabled (interval <= 0)');
    }

    this.emitTelemetrySnapshot('startup');
  }

  stopTelemetry(): void {
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
      console.log('[Deduplicator] ⏹️ Telemetry loop stopped');
    }
  }

  emitTelemetrySnapshot(reason: 'interval' | 'manual' | 'startup' = 'manual'): void {
    if (!this.telemetryOptions) {
      return;
    }

    const snapshot = this.buildTelemetrySnapshot(reason);
    const shouldLogSample =
      this.telemetryOptions.logHealthySamples || snapshot.staleBitQueryCount > 0;

    if (shouldLogSample) {
      console.log(
        `[Deduplicator] 📊 Telemetry (${reason}) clients=${snapshot.totalClients} external=${snapshot.externalSubscriptions} ratio=${snapshot.dedupRatio.toFixed(
          1,
        )}x savings=${snapshot.savingsPercentage.toFixed(1)}% bitquerySubs=${snapshot.bitquerySubscriptions}`,
      );
    }

    if (snapshot.staleBitQueryCount > 0) {
      console.warn(
        `[Deduplicator] ⚠️ ${snapshot.staleBitQueryCount} BitQuery stream(s) stale for > ${
          this.telemetryOptions.staleThresholdMs
        }ms`,
        snapshot.staleBitQuerySubscriptions,
      );
    }

    const ratioAlert =
      snapshot.bitquerySubscriptions > 0 &&
      snapshot.dedupRatio > 0 &&
      snapshot.dedupRatio < this.telemetryOptions.minHealthyRatio;

    const shouldSendSentry =
      this.telemetryOptions.sentryEnabled && (snapshot.staleBitQueryCount > 0 || ratioAlert);

    if (shouldSendSentry) {
      const level: Sentry.SeverityLevel = snapshot.staleBitQueryCount > 0 ? 'warning' : 'info';
      this.captureTelemetrySnapshot(snapshot, level);
    }
  }

  private buildTelemetrySnapshot(reason: string): DedupTelemetrySnapshot {
    const stats = this.getDetailedStats();
    const bitQueryStats = stats.byDataSource.bitquery ?? { subscriptions: 0, clients: 0 };
    const staleThreshold = this.telemetryOptions?.staleThresholdMs ?? 45_000;

    const staleBitQuerySubscriptions = stats.subscriptions
      .filter(
        (sub) =>
          sub.dataSource === 'bitquery' &&
          typeof sub.lastData === 'number' &&
          sub.lastData >= staleThreshold,
      )
      .map((sub) => ({
        key: sub.key,
        clients: sub.clients,
        lastDataMsAgo: sub.lastData as number,
        uptimeMs: sub.uptimeMs,
      }));

    const busiestSubscriptions = stats.subscriptions
      .slice()
      .sort((a, b) => b.clients - a.clients)
      .slice(0, 5)
      .map((sub) => ({
        key: sub.key,
        clients: sub.clients,
        dataSource: sub.dataSource,
      }));

    return {
      reason,
      timestamp: new Date().toISOString(),
      totalClients: stats.totalClients,
      externalSubscriptions: stats.externalSubscriptions,
      dedupRatio: stats.dedupRatio,
      savingsPercentage: stats.savings.savingsPercentage,
      bitquerySubscriptions: bitQueryStats.subscriptions,
      bitqueryClients: bitQueryStats.clients,
      staleBitQueryCount: staleBitQuerySubscriptions.length,
      staleBitQuerySubscriptions,
      busiestSubscriptions,
    };
  }

  private captureTelemetrySnapshot(
    snapshot: DedupTelemetrySnapshot,
    level: Sentry.SeverityLevel,
  ): void {
    if (!this.telemetryOptions?.sentryEnabled) {
      return;
    }

    const now = Date.now();
    if (
      this.lastTelemetrySentryAt &&
      now - this.lastTelemetrySentryAt < this.telemetryOptions.sentryThrottleMs
    ) {
      console.log('[Deduplicator] ⏱️ Sentry telemetry skipped (throttled)');
      return;
    }

    this.lastTelemetrySentryAt = now;

    try {
      Sentry.captureEvent({
        level,
        message: 'BitQuery WS dedup telemetry snapshot',
        tags: {
          component: 'ws-deduplicator',
          dataSource: 'bitquery',
        },
        extra: { ...snapshot },
      });
      console.log('[Deduplicator] 🛰️ Sentry telemetry snapshot sent');
    } catch (error) {
      console.warn('[Deduplicator] ⚠️ Failed to capture telemetry snapshot in Sentry:', error);
    }
  }
}
