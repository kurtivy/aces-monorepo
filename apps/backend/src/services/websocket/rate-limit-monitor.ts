/**
 * Rate Limit Monitor
 * US-8.2: Monitor and alert on rate limit usage
 *
 * Responsibilities:
 * - Track API calls per service
 * - Calculate usage percentage vs limits
 * - Alert when approaching limits
 * - Provide real-time metrics
 */

import { EventEmitter } from 'events';
import { RateLimitConfig, RateLimitUsage } from '../../types/websocket';

interface RateLimitCounter {
  service: string;
  count: number;
  window: number; // Window start time (minute-based)
  startedAt: number;
}

interface Alert {
  severity: 'warning' | 'critical';
  service: string;
  usage: number;
  message: string;
  timestamp: number;
}

export class RateLimitMonitor extends EventEmitter {
  private counters = new Map<string, RateLimitCounter>();
  private alerts: Alert[] = [];
  private readonly MAX_ALERTS = 100;

  // Rate limits for external services
  private limits: Record<string, RateLimitConfig> = {
    bitquery: { service: 'bitquery', max: 1000, window: 60000 }, // 1000 req/min
    goldsky: { service: 'goldsky', max: Infinity, window: 60000 }, // Unlimited on paid
    aerodrome: { service: 'aerodrome', max: 100, window: 60000 }, // 100 req/min
    quicknode: { service: 'quicknode', max: Infinity, window: 60000 }, // Unlimited
  };

  constructor() {
    super();
    // Cleanup old windows every minute
    setInterval(() => this.cleanupOldWindows(), 60000);
  }

  /**
   * Record an API request
   */
  recordRequest(service: string): void {
    const key = this.getCounterKey(service);

    if (!this.counters.has(key)) {
      this.counters.set(key, {
        service,
        count: 0,
        window: this.getCurrentWindow(),
        startedAt: Date.now(),
      });
    }

    const counter = this.counters.get(key)!;
    counter.count++;

    // Check usage and alert if needed
    const limit = this.limits[service];
    if (limit && limit.max !== Infinity) {
      const usage = counter.count / limit.max;

      if (usage > 0.95) {
        this.emitAlert('critical', service, usage);
      } else if (usage > 0.8) {
        this.emitAlert('warning', service, usage);
      }
    }
  }

  /**
   * Get current usage for a service
   */
  getUsage(service: string): RateLimitUsage {
    const key = this.getCounterKey(service);
    const counter = this.counters.get(key);
    const limit = this.limits[service];

    if (!limit) {
      throw new Error(`Unknown service: ${service}`);
    }

    const current = counter?.count || 0;
    const percentage = limit.max !== Infinity ? (current / limit.max) * 100 : 0;

    return {
      service,
      current,
      limit: limit.max,
      percentage: Math.round(percentage * 10) / 10,
      resetIn: this.getTimeUntilReset(),
      status: this.getStatus(percentage),
    };
  }

  /**
   * Get usage for all services
   */
  getAllUsage(): Record<string, RateLimitUsage> {
    const usage: Record<string, RateLimitUsage> = {};

    Object.keys(this.limits).forEach((service) => {
      usage[service] = this.getUsage(service);
    });

    return usage;
  }

  /**
   * Update rate limit configuration
   */
  updateLimit(service: string, config: RateLimitConfig): void {
    this.limits[service] = config;
    console.log(`[RateLimitMonitor] Updated limit for ${service}:`, config);
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 10): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Emit rate limit alert
   */
  private emitAlert(severity: 'warning' | 'critical', service: string, usage: number): void {
    const alert: Alert = {
      severity,
      service,
      usage: Math.round(usage * 1000) / 10, // Convert to percentage
      message: `Rate limit ${severity}: ${service} at ${Math.round(usage * 100)}%`,
      timestamp: Date.now(),
    };

    // Deduplicate alerts (don't spam same alert)
    const lastAlert = this.alerts[this.alerts.length - 1];
    if (
      lastAlert &&
      lastAlert.service === service &&
      lastAlert.severity === severity &&
      Date.now() - lastAlert.timestamp < 60000 // Within 1 minute
    ) {
      return; // Skip duplicate
    }

    this.alerts.push(alert);
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.shift();
    }

    console.error(`[RateLimitMonitor] 🚨 ${alert.message}`);
    this.emit('rate_limit_alert', alert);
  }

  /**
   * Get counter key (service + current window)
   */
  private getCounterKey(service: string): string {
    return `${service}:${this.getCurrentWindow()}`;
  }

  /**
   * Get current time window (minute-based)
   */
  private getCurrentWindow(): number {
    return Math.floor(Date.now() / 60000);
  }

  /**
   * Get time until window resets
   */
  private getTimeUntilReset(): number {
    const currentWindow = this.getCurrentWindow();
    const nextWindow = currentWindow + 1;
    return nextWindow * 60000 - Date.now();
  }

  /**
   * Get status based on percentage
   */
  private getStatus(percentage: number): 'healthy' | 'warning' | 'critical' {
    if (percentage >= 95) return 'critical';
    if (percentage >= 80) return 'warning';
    return 'healthy';
  }

  /**
   * Cleanup old time windows
   */
  private cleanupOldWindows(): void {
    const currentWindow = this.getCurrentWindow();
    const keysToDelete: string[] = [];

    this.counters.forEach((counter, key) => {
      if (counter.window < currentWindow - 5) {
        // Keep last 5 windows
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.counters.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[RateLimitMonitor] 🧹 Cleaned up ${keysToDelete.length} old windows`);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const usage = this.getAllUsage();
    const totalRequests = Array.from(this.counters.values()).reduce(
      (sum, counter) => sum + counter.count,
      0,
    );

    return {
      totalRequests,
      usage,
      alerts: this.alerts.length,
      recentAlerts: this.getAlerts(5),
    };
  }
}

