/**
 * 🔥 PHASE 3: Connection Health Monitor
 *
 * Logs connection health metrics periodically and detects anomalies.
 * Provides diagnostic data for troubleshooting and monitoring.
 * 🔥 PHASE 5: Integrates with Sentry for error tracking
 */

import * as Sentry from '@sentry/nextjs';
import { sharedTradeWebSocket } from './shared-trade-websocket';

export interface HealthSnapshot {
  timestamp: number;
  tokenAddress: string;
  isConnected: boolean;
  missedPongs: number;
  totalPings: number;
  totalPongs: number;
  pingPongRatio: number;
  timeSinceLastMessage: number;
  lastPongTime: number | null;
}

export interface HealthAnomaly {
  type: 'high_missed_pongs' | 'low_pong_ratio' | 'high_idle_time' | 'connection_dropped';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
}

class ConnectionHealthMonitor {
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private healthHistory = new Map<string, HealthSnapshot[]>();
  private anomalyHistory = new Map<string, HealthAnomaly[]>();
  private readonly MAX_HISTORY = 100; // Keep last 100 snapshots
  private readonly METRICS_INTERVAL_MS = 60000; // Log metrics every 60 seconds
  private readonly ANOMALY_CHECK_INTERVAL_MS = 30000; // Check anomalies every 30 seconds

  /**
   * Start monitoring a token's connection health
   */
  startMonitoring(tokenAddress: string, debug = false): void {
    const normalizedAddress = tokenAddress.toLowerCase();

    if (this.monitoringIntervals.has(normalizedAddress)) {
      console.warn(`[HealthMonitor] Already monitoring ${normalizedAddress}, skipping...`);
      return;
    }

    console.log(`[HealthMonitor] 📊 Starting health monitoring for ${tokenAddress}`);

    // Initialize history
    if (!this.healthHistory.has(normalizedAddress)) {
      this.healthHistory.set(normalizedAddress, []);
    }
    if (!this.anomalyHistory.has(normalizedAddress)) {
      this.anomalyHistory.set(normalizedAddress, []);
    }

    // 🔥 PHASE 3: Log metrics every 60 seconds
    const metricsInterval = setInterval(() => {
      this.logHealthMetrics(normalizedAddress, debug);
    }, this.METRICS_INTERVAL_MS);

    // 🔥 PHASE 3: Check for anomalies every 30 seconds
    const anomalyInterval = setInterval(() => {
      this.checkForAnomalies(normalizedAddress, debug);
    }, this.ANOMALY_CHECK_INTERVAL_MS);

    this.monitoringIntervals.set(normalizedAddress, metricsInterval);

    // Store anomaly interval as a property for cleanup
    (this.monitoringIntervals as any).set(`${normalizedAddress}_anomaly`, anomalyInterval);
  }

  /**
   * Stop monitoring a token's connection health
   */
  stopMonitoring(tokenAddress: string): void {
    const normalizedAddress = tokenAddress.toLowerCase();

    const metricsInterval = this.monitoringIntervals.get(normalizedAddress);
    const anomalyInterval = (this.monitoringIntervals as any).get(`${normalizedAddress}_anomaly`);

    if (metricsInterval) {
      clearInterval(metricsInterval);
      this.monitoringIntervals.delete(normalizedAddress);
      console.log(`[HealthMonitor] ✅ Stopped metrics monitoring for ${tokenAddress}`);
    }

    if (anomalyInterval) {
      clearInterval(anomalyInterval);
      (this.monitoringIntervals as any).delete(`${normalizedAddress}_anomaly`);
      console.log(`[HealthMonitor] ✅ Stopped anomaly monitoring for ${tokenAddress}`);
    }
  }

  /**
   * 🔥 PHASE 3: Log current health metrics
   */
  private logHealthMetrics(tokenAddress: string, debug: boolean): void {
    const metrics = sharedTradeWebSocket.getHealthMetrics(tokenAddress);
    if (!metrics) {
      console.warn(`[HealthMonitor] ⚠️ No metrics available for ${tokenAddress}`);
      return;
    }

    const snapshot: HealthSnapshot = {
      timestamp: Date.now(),
      tokenAddress,
      isConnected: metrics.isConnected,
      missedPongs: metrics.missedPongs,
      totalPings: metrics.totalPings,
      totalPongs: metrics.totalPongs,
      pingPongRatio:
        metrics.totalPings > 0 ? Math.round((metrics.totalPongs / metrics.totalPings) * 100) : 0,
      timeSinceLastMessage: metrics.timeSinceLastMessage,
      lastPongTime: metrics.lastPongTime,
    };

    // 🔥 PHASE 3: Store snapshot in history
    const history = this.healthHistory.get(tokenAddress);
    if (history) {
      history.push(snapshot);
      // Keep only last MAX_HISTORY snapshots
      if (history.length > this.MAX_HISTORY) {
        history.shift();
      }
    }

    // 🔥 PHASE 3: Log metrics
    const statusEmoji = metrics.isConnected ? '🟢' : '🔴';
    const qualityBar = this.generateQualityBar(snapshot.pingPongRatio, snapshot.missedPongs);

    console.log(`[HealthMonitor] ${statusEmoji} Health Check for ${tokenAddress}`, {
      ...snapshot,
      quality: qualityBar,
    });

    if (debug) {
      console.log(`[HealthMonitor] 📊 Detailed Metrics:`, {
        isConnected: metrics.isConnected ? '✅' : '❌',
        totalPings: metrics.totalPings,
        totalPongs: metrics.totalPongs,
        missedPongs: metrics.missedPongs,
        pongRatio: `${snapshot.pingPongRatio}%`,
        timeSinceLastMessage: `${metrics.timeSinceLastMessage}ms`,
        lastPongAge: metrics.lastPongTime ? `${Date.now() - metrics.lastPongTime}ms ago` : 'never',
      });
    }
  }

  /**
   * 🔥 PHASE 3: Check for anomalies and alert if found
   */
  private checkForAnomalies(tokenAddress: string, debug: boolean): void {
    const metrics = sharedTradeWebSocket.getHealthMetrics(tokenAddress);
    if (!metrics) return;

    const anomalies: HealthAnomaly[] = [];

    // Check for high missed pongs
    if (metrics.missedPongs >= 2) {
      anomalies.push({
        type: 'high_missed_pongs',
        severity: 'critical',
        message: `${metrics.missedPongs} missed pongs detected - connection may be dying`,
        timestamp: Date.now(),
      });
    } else if (metrics.missedPongs >= 1) {
      anomalies.push({
        type: 'high_missed_pongs',
        severity: 'warning',
        message: `${metrics.missedPongs} missed pong detected - monitor closely`,
        timestamp: Date.now(),
      });
    }

    // Check for low pong ratio (less than 80% pongs received)
    const pongRatio = metrics.totalPings > 0 ? metrics.totalPongs / metrics.totalPings : 1;
    if (pongRatio < 0.8 && metrics.totalPings > 5) {
      anomalies.push({
        type: 'low_pong_ratio',
        severity: 'warning',
        message: `Pong ratio ${Math.round(pongRatio * 100)}% - some pongs being lost`,
        timestamp: Date.now(),
      });
    }

    // Check for high idle time (no messages in 45+ seconds)
    if (metrics.timeSinceLastMessage > 45000) {
      anomalies.push({
        type: 'high_idle_time',
        severity: 'warning',
        message: `No messages for ${Math.round(metrics.timeSinceLastMessage / 1000)}s - connection may be stale`,
        timestamp: Date.now(),
      });
    }

    // Check for disconnection
    if (!metrics.isConnected) {
      anomalies.push({
        type: 'connection_dropped',
        severity: 'critical',
        message: 'Connection is disconnected',
        timestamp: Date.now(),
      });
    }

    // Log anomalies
    if (anomalies.length > 0) {
      const anomalyHistory = this.anomalyHistory.get(tokenAddress);
      if (anomalyHistory) {
        anomalyHistory.push(...anomalies);
        if (anomalyHistory.length > this.MAX_HISTORY) {
          anomalyHistory.splice(0, anomalies.length);
        }
      }

      for (const anomaly of anomalies) {
        const icon = anomaly.severity === 'critical' ? '❌' : '⚠️';
        console.warn(`[HealthMonitor] ${icon} ${anomaly.type}: ${anomaly.message}`);

        // 🔥 PHASE 5: Report anomalies to Sentry
        try {
          const level = anomaly.severity === 'critical' ? 'error' : 'warning';
          Sentry.captureMessage(`WebSocket: ${anomaly.message}`, level);
          const pingPongRatio =
            metrics.totalPings > 0
              ? Math.round((metrics.totalPongs / metrics.totalPings) * 100)
              : 0;
          Sentry.captureEvent({
            level,
            message: anomaly.message,
            tags: {
              component: 'connection-health-monitor',
              tokenAddress,
              anomalyType: anomaly.type,
              severity: anomaly.severity,
            },
            contexts: {
              websocket: {
                tokenAddress,
                isConnected: metrics.isConnected,
                missedPongs: metrics.missedPongs,
                totalPings: metrics.totalPings,
                totalPongs: metrics.totalPongs,
                pingPongRatio: `${pingPongRatio}%`,
                timeSinceLastMessage: `${metrics.timeSinceLastMessage}ms`,
              },
            },
          });
        } catch (error) {
          console.error('[HealthMonitor] Failed to report anomaly to Sentry:', error);
        }
      }
    } else if (debug) {
      console.log(`[HealthMonitor] ✅ No anomalies detected for ${tokenAddress}`);
    }
  }

  /**
   * Generate a simple quality bar for visualization
   */
  private generateQualityBar(pongRatio: number, missedPongs: number): string {
    const blocks = Math.round(pongRatio / 10);
    const empty = 10 - blocks;

    if (missedPongs >= 2) {
      return `[${blocks > 0 ? '🔴'.repeat(blocks) : ''}${empty > 0 ? '⬜'.repeat(empty) : ''}] ${pongRatio}%`;
    } else if (missedPongs >= 1) {
      return `[${blocks > 0 ? '🟡'.repeat(blocks) : ''}${empty > 0 ? '⬜'.repeat(empty) : ''}] ${pongRatio}%`;
    } else if (pongRatio >= 95) {
      return `[${blocks > 0 ? '🟢'.repeat(blocks) : ''}${empty > 0 ? '⬜'.repeat(empty) : ''}] ${pongRatio}%`;
    } else {
      return `[${blocks > 0 ? '🟡'.repeat(blocks) : ''}${empty > 0 ? '⬜'.repeat(empty) : ''}] ${pongRatio}%`;
    }
  }

  /**
   * Get health history for a token
   */
  getHealthHistory(tokenAddress: string): HealthSnapshot[] {
    return this.healthHistory.get(tokenAddress.toLowerCase()) || [];
  }

  /**
   * Get anomaly history for a token
   */
  getAnomalyHistory(tokenAddress: string): HealthAnomaly[] {
    return this.anomalyHistory.get(tokenAddress.toLowerCase()) || [];
  }

  /**
   * Get a health report for a token
   */
  getHealthReport(tokenAddress: string): {
    currentHealth: HealthSnapshot | null;
    anomalies: HealthAnomaly[];
    historyCount: number;
    averagePongRatio: number;
    trend: 'improving' | 'stable' | 'degrading';
  } | null {
    const normalizedAddress = tokenAddress.toLowerCase();
    const history = this.healthHistory.get(normalizedAddress);
    const anomalies = this.anomalyHistory.get(normalizedAddress);

    if (!history || history.length === 0) {
      return null;
    }

    const currentHealth = history[history.length - 1];
    const averagePongRatio =
      history.length > 0
        ? Math.round(history.reduce((sum, h) => sum + h.pingPongRatio, 0) / history.length)
        : 0;

    // Determine trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (history.length >= 3) {
      const recent = history.slice(-3);
      const older = history.slice(-6, -3);

      if (older.length > 0) {
        const recentAvg = recent.reduce((sum, h) => sum + h.pingPongRatio, 0) / recent.length;
        const olderAvg = older.reduce((sum, h) => sum + h.pingPongRatio, 0) / older.length;

        if (recentAvg > olderAvg + 5) {
          trend = 'improving';
        } else if (recentAvg < olderAvg - 5) {
          trend = 'degrading';
        }
      }
    }

    return {
      currentHealth,
      anomalies: anomalies || [],
      historyCount: history.length,
      averagePongRatio,
      trend,
    };
  }

  /**
   * Export health report as JSON
   */
  exportHealthReport(tokenAddress: string): string {
    const report = this.getHealthReport(tokenAddress);
    return JSON.stringify(report, null, 2);
  }
}

// Singleton instance
export const connectionHealthMonitor = new ConnectionHealthMonitor();
