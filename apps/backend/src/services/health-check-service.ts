import { FastifyInstance } from 'fastify';

export type HealthStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
export type ComponentStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';

export interface ComponentHealth {
  name: string;
  status: ComponentStatus;
  latency?: number; // ms
  lastChecked: Date;
  error?: string;
  statusCode?: number;
  responseBody?: string; // Truncated response body for debugging
  errorType?: 'timeout' | 'http_error' | 'network_error' | 'parse_error' | 'unknown';
  uptime: {
    last24h: number; // percentage
    last7d: number;
    last30d: number;
  };
  // Time-based history for visualization
  history?: Array<{
    timestamp: Date;
    status: ComponentStatus;
    latency?: number;
    error?: string;
  }>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  components: ComponentHealth[];
  uptime: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

interface HealthCheckHistory {
  timestamp: Date;
  components: Map<string, ComponentHealth>;
}

export class HealthCheckService {
  private fastify: FastifyInstance;
  private checkInterval: NodeJS.Timeout | null = null;
  private history: HealthCheckHistory[] = [];
  private readonly MAX_HISTORY = 1000; // Keep last 1000 checks (~7 days at 1min intervals)
  private readonly CHECK_INTERVAL_MS = 60000; // Check every 60 seconds
  private readonly HISTORY_RETENTION_HOURS = 24; // Keep detailed history for 24 hours

  // Comprehensive list of endpoints to monitor
  private readonly endpoints: Array<{
    name: string;
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    expectedStatus: number | number[];
    timeout?: number;
    category: string;
    requiresAuth?: boolean;
  }> = [
    // Core Infrastructure
    { name: 'API Gateway', path: '/health/live', method: 'GET', expectedStatus: 200, category: 'Infrastructure' },
    { name: 'Database', path: '/health/ready', method: 'GET', expectedStatus: 200, category: 'Infrastructure' },
    { name: 'WebSocket Stats', path: '/api/v1/ws/stats', method: 'GET', expectedStatus: 200, category: 'Infrastructure' },
    
    // Prices API
    { name: 'Prices - ACES/USD', path: '/api/v1/prices/aces-usd', method: 'GET', expectedStatus: 200, category: 'Prices' },
    { name: 'Prices - WETH/USD', path: '/api/v1/prices/weth-usd', method: 'GET', expectedStatus: 200, category: 'Prices' },
    
    // Tokens API
    { name: 'Tokens - List', path: '/api/v1/tokens?limit=1', method: 'GET', expectedStatus: 200, category: 'Tokens' },
    
    // Listings API
    { name: 'Listings - List', path: '/api/v1/listings?limit=1', method: 'GET', expectedStatus: 200, category: 'Listings' },
    
    // Chart API
    { name: 'Chart - Unified', path: '/api/v1/chart/unified?tokenAddress=0x0000000000000000000000000000000000000000&timeframe=1h&from=2024-01-01&to=2024-01-02', method: 'GET', expectedStatus: 200, timeout: 10000, category: 'Chart' },
    
    // Bonding API
    { name: 'Bonding - Data', path: '/api/v1/bonding/data?tokenAddress=0x0000000000000000000000000000000000000000', method: 'GET', expectedStatus: 200, category: 'Bonding' },
    
    // DEX API
    { name: 'DEX - Pool Info', path: '/api/v1/dex/pool?tokenAddress=0x0000000000000000000000000000000000000000', method: 'GET', expectedStatus: 200, category: 'DEX' },
    
    // Portfolio API
    { name: 'Portfolio - List', path: '/api/v1/portfolio?limit=1', method: 'GET', expectedStatus: 200, category: 'Portfolio' },
    
    // Users API (401 is OK - means endpoint is working)
    { name: 'Users - Profile', path: '/api/v1/users/me', method: 'GET', expectedStatus: [200, 401], requiresAuth: false, category: 'Users' },
    
    // Submissions API
    { name: 'Submissions - List', path: '/api/v1/submissions?limit=1', method: 'GET', expectedStatus: 200, category: 'Submissions' },
    
    // Bids API
    { name: 'Bids - List', path: '/api/v1/bids?limit=1', method: 'GET', expectedStatus: 200, category: 'Bids' },
    
    // Notifications API
    { name: 'Notifications - List', path: '/api/v1/notifications?limit=1', method: 'GET', expectedStatus: [200, 401], requiresAuth: false, category: 'Notifications' },
    
    // Comments API
    { name: 'Comments - List', path: '/api/v1/comments?limit=1', method: 'GET', expectedStatus: 200, category: 'Comments' },
    
    // Contact API
    { name: 'Contact - Health', path: '/api/v1/contact', method: 'GET', expectedStatus: [200, 404, 405], category: 'Contact' },
    
    // Twitch API
    { name: 'Twitch - Health', path: '/api/v1/twitch/health', method: 'GET', expectedStatus: [200, 404], category: 'Twitch' },
    
    // Product Images API
    { name: 'Product Images - Health', path: '/api/v1/product-images', method: 'GET', expectedStatus: [200, 404, 405], category: 'Product Images' },
    
    // Token Creation API
    { name: 'Token Creation - Health', path: '/api/v1/token-creation', method: 'GET', expectedStatus: [200, 404, 405], category: 'Token Creation' },
    
    // Verification API
    { name: 'Verification - Health', path: '/api/v1/verification', method: 'GET', expectedStatus: [200, 404, 405], category: 'Verification' },
    
    // Admin API (401 is OK - means endpoint is working)
    { name: 'Admin - Dashboard', path: '/api/v1/admin/dashboard', method: 'GET', expectedStatus: [200, 401, 403], requiresAuth: false, category: 'Admin' },
  ];

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.checkInterval) {
      return; // Already running
    }

    // Run initial check immediately
    this.runHealthCheck().catch((err) => {
      this.fastify.log.error({ err }, 'Initial health check failed');
    });

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runHealthCheck().catch((err) => {
        this.fastify.log.error({ err }, 'Periodic health check failed');
      });
    }, this.CHECK_INTERVAL_MS);

    this.fastify.log.info('Health check service started');
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.fastify.log.info('Health check service stopped');
  }

  /**
   * Run health check for all endpoints
   */
  private async runHealthCheck(): Promise<void> {
    const startTime = Date.now();
    const components = new Map<string, ComponentHealth>();

    // Check all endpoints in parallel
    const checkPromises = this.endpoints.map((endpoint) =>
      this.checkEndpoint(endpoint).then((result) => {
        components.set(endpoint.name, result);
      })
    );

    await Promise.allSettled(checkPromises);

    // Store history
    this.history.push({
      timestamp: new Date(),
      components,
    });

    // Trim history if too large
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    const duration = Date.now() - startTime;
    this.fastify.log.debug(`Health check completed in ${duration}ms`);
  }

  /**
   * Check a single endpoint using Fastify's internal inject method
   */
  private async checkEndpoint(endpoint: {
    name: string;
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    expectedStatus: number | number[];
    timeout?: number;
  }): Promise<ComponentHealth> {
    const startTime = Date.now();
    const expectedStatuses = Array.isArray(endpoint.expectedStatus)
      ? endpoint.expectedStatus
      : [endpoint.expectedStatus];
    const timeout = endpoint.timeout || 5000;

    try {
      // Use Promise.race to implement timeout
      const checkPromise = this.fastify.inject({
        method: endpoint.method,
        url: endpoint.path,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      const response = await Promise.race([checkPromise, timeoutPromise]);
      const latency = Date.now() - startTime;

      // Parse response body for debugging
      let responseBody: string | undefined;
      try {
        const bodyStr = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
        // Truncate to first 200 characters
        responseBody = bodyStr.length > 200 ? bodyStr.substring(0, 200) + '...' : bodyStr;
      } catch {
        // Ignore parse errors
      }

      const isHealthy = expectedStatuses.includes(response.statusCode);
      let status: ComponentStatus;
      let errorType: 'timeout' | 'http_error' | 'network_error' | 'parse_error' | 'unknown' | undefined;
      let errorMessage: string | undefined;

      if (isHealthy) {
        status = latency > 2000 ? 'degraded' : 'operational';
      } else {
        status = 'major_outage';
        errorType = 'http_error';
        errorMessage = `HTTP ${response.statusCode} - Expected ${expectedStatuses.join(' or ')}, got ${response.statusCode}`;
        
        // Add response body snippet if available
        if (responseBody) {
          errorMessage += ` | Response: ${responseBody}`;
        }
      }

      const uptime = this.calculateUptime(endpoint.name);
      const history = this.getComponentHistory(endpoint.name);

      return {
        name: endpoint.name,
        status,
        latency,
        lastChecked: new Date(),
        statusCode: response.statusCode,
        responseBody,
        errorType,
        error: errorMessage,
        uptime,
        history,
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      let errorType: 'timeout' | 'http_error' | 'network_error' | 'parse_error' | 'unknown';
      let errorMessage: string;

      if (error.message?.includes('timeout')) {
        errorType = 'timeout';
        errorMessage = `Request timeout after ${timeout}ms`;
      } else if (error.message) {
        errorType = 'network_error';
        errorMessage = error.message;
      } else {
        errorType = 'unknown';
        errorMessage = 'Unknown error occurred';
      }

      const uptime = this.calculateUptime(endpoint.name);
      const history = this.getComponentHistory(endpoint.name);

      return {
        name: endpoint.name,
        status: 'major_outage',
        latency,
        lastChecked: new Date(),
        error: errorMessage,
        errorType,
        uptime,
        history,
      };
    }
  }

  /**
   * Get time-based history for a component (last 24 hours)
   */
  private getComponentHistory(componentName: string): Array<{
    timestamp: Date;
    status: ComponentStatus;
    latency?: number;
    error?: string;
  }> {
    const cutoffTime = Date.now() - this.HISTORY_RETENTION_HOURS * 60 * 60 * 1000;
    
    return this.history
      .filter((h) => h.timestamp.getTime() >= cutoffTime)
      .map((h) => {
        const component = h.components.get(componentName);
        if (!component) return null;
        
        return {
          timestamp: h.timestamp,
          status: component.status,
          latency: component.latency,
          error: component.error,
        };
      })
      .filter((h): h is NonNullable<typeof h> => h !== null)
      .slice(-100); // Last 100 checks
  }

  /**
   * Calculate uptime percentages for a component
   */
  private calculateUptime(componentName: string): {
    last24h: number;
    last7d: number;
    last30d: number;
  } {
    const now = Date.now();
    const day24h = now - 24 * 60 * 60 * 1000;
    const day7d = now - 7 * 24 * 60 * 60 * 1000;
    const day30d = now - 30 * 24 * 60 * 60 * 1000;

    const calculate = (since: number): number => {
      const relevant = this.history.filter((h) => h.timestamp.getTime() >= since);
      if (relevant.length === 0) return 100; // No data = assume operational

      const componentChecks = relevant.map((h) => h.components.get(componentName));
      const operational = componentChecks.filter(
        (c) => c && (c.status === 'operational' || c.status === 'degraded')
      ).length;

      return (operational / componentChecks.length) * 100;
    };

    return {
      last24h: calculate(day24h),
      last7d: calculate(day7d),
      last30d: calculate(day30d),
    };
  }

  /**
   * Get current health status
   */
  getStatus(): HealthCheckResult {
    const components: ComponentHealth[] = [];

    if (this.history.length === 0) {
      // No checks yet, return default status
      return {
        status: 'operational',
        timestamp: new Date(),
        components: [],
        uptime: { last24h: 100, last7d: 100, last30d: 100 },
      };
    }

    // Get latest check results
    const latest = this.history[this.history.length - 1];
    latest.components.forEach((component) => {
      // Add history for visualization
      const history = this.getComponentHistory(component.name);
      components.push({
        ...component,
        history,
      });
    });

    // Determine overall status
    const hasMajorOutage = components.some((c) => c.status === 'major_outage');
    const hasPartialOutage = components.some((c) => c.status === 'partial_outage');
    const hasDegraded = components.some((c) => c.status === 'degraded');

    let overallStatus: HealthStatus = 'operational';
    if (hasMajorOutage) {
      overallStatus = 'major_outage';
    } else if (hasPartialOutage) {
      overallStatus = 'partial_outage';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    // Calculate overall uptime
    const now = Date.now();
    const day24h = now - 24 * 60 * 60 * 1000;
    const day7d = now - 7 * 24 * 60 * 60 * 1000;
    const day30d = now - 30 * 24 * 60 * 60 * 1000;

    const calculateOverallUptime = (since: number): number => {
      const relevant = this.history.filter((h) => h.timestamp.getTime() >= since);
      if (relevant.length === 0) return 100;

      let totalOperational = 0;
      let totalChecks = 0;

      relevant.forEach((h) => {
        h.components.forEach((component) => {
          totalChecks++;
          if (component.status === 'operational' || component.status === 'degraded') {
            totalOperational++;
          }
        });
      });

      return totalChecks > 0 ? (totalOperational / totalChecks) * 100 : 100;
    };

    return {
      status: overallStatus,
      timestamp: latest.timestamp,
      components,
      uptime: {
        last24h: calculateOverallUptime(day24h),
        last7d: calculateOverallUptime(day7d),
        last30d: calculateOverallUptime(day30d),
      },
    };
  }

  /**
   * Get incident history (periods of downtime)
   */
  getIncidents(): Array<{
    start: Date;
    end?: Date;
    components: string[];
    status: ComponentStatus;
    error?: string;
  }> {
    const incidents: Array<{
      start: Date;
      end?: Date;
      components: string[];
      status: ComponentStatus;
      error?: string;
    }> = [];

    // Group consecutive outages by component
    const componentOutages = new Map<string, Array<{ start: Date; end?: Date; error?: string }>>();

    this.history.forEach((check) => {
      check.components.forEach((component) => {
        if (component.status === 'major_outage' || component.status === 'partial_outage') {
          const outages = componentOutages.get(component.name) || [];
          const lastOutage = outages[outages.length - 1];

          if (
            lastOutage &&
            !lastOutage.end &&
            check.timestamp.getTime() - lastOutage.start.getTime() < this.CHECK_INTERVAL_MS * 2
          ) {
            // Continue existing outage
            // Check if still down
            if (component.status === 'major_outage' || component.status === 'partial_outage') {
              // Still down, continue
              if (component.error && !lastOutage.error) {
                lastOutage.error = component.error;
              }
            } else {
              // Recovered
              lastOutage.end = check.timestamp;
            }
          } else {
            // New outage
            outages.push({ start: check.timestamp, error: component.error });
          }
          componentOutages.set(component.name, outages);
        }
      });
    });

    // Convert to incident format
    componentOutages.forEach((outages, componentName) => {
      outages.forEach((outage) => {
        incidents.push({
          start: outage.start,
          end: outage.end,
          components: [componentName],
          status: 'major_outage',
          error: outage.error,
        });
      });
    });

    // Sort by start time (newest first)
    return incidents.sort((a, b) => b.start.getTime() - a.start.getTime());
  }

  /**
   * Get all monitored endpoints
   */
  getEndpoints(): Array<{
    name: string;
    path: string;
    method: string;
    category: string;
    expectedStatus: number | number[];
  }> {
    return this.endpoints.map((e) => ({
      name: e.name,
      path: e.path,
      method: e.method,
      category: e.category,
      expectedStatus: e.expectedStatus,
    }));
  }
}
