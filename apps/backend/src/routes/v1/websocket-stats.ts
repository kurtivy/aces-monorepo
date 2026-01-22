/**
 * WebSocket Stats Route
 * Provides real-time statistics and monitoring for WebSocket gateway
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebSocketGateway } from '../../gateway/websocket-gateway';

const getStatsToken = (fastify: FastifyInstance): string | null => {
  const config = (fastify as any).config;
  if (config && typeof config.WS_STATS_TOKEN === 'string') {
    return config.WS_STATS_TOKEN;
  }
  if ((fastify as any).WS_STATS_TOKEN) {
    return (fastify as any).WS_STATS_TOKEN;
  }
  if (process.env.WS_STATS_TOKEN) {
    return process.env.WS_STATS_TOKEN;
  }
  return null;
};

const requireStatsToken =
  (fastify: FastifyInstance) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = getStatsToken(fastify);
    if (!token) {
      return;
    }
    const headerToken = request.headers['x-ws-stats-token'];
    if (typeof headerToken !== 'string' || headerToken !== token) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }
  };

export async function websocketStatsRoutes(fastify: FastifyInstance) {
  const token = getStatsToken(fastify);
  const statsGuard = token ? requireStatsToken(fastify) : undefined;
  /**
   * GET /api/v1/ws/stats
   * Get comprehensive WebSocket gateway statistics
   */
  fastify.get('/api/v1/ws/stats', { preHandler: statsGuard || undefined }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const gateway = WebSocketGateway.getInstance();
      const stats = gateway.getStats();

      return reply.send({
        success: true,
        data: stats,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[WebSocket Stats] Error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve WebSocket stats',
      });
    }
  });

  /**
   * GET /api/v1/ws/health
   * Health check endpoint
   */
  fastify.get('/api/v1/ws/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const gateway = WebSocketGateway.getInstance();
      const stats = gateway.getStats();

      const isHealthy = stats.connectedClients >= 0; // Basic health check

      return reply.code(isHealthy ? 200 : 503).send({
        success: true,
        healthy: isHealthy,
        stats: {
          connectedClients: stats.connectedClients,
          activeSubscriptions: stats.activeSubscriptions,
          uptimeMs: stats.uptimeMs,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return reply.code(503).send({
        success: false,
        healthy: false,
        error: 'Gateway not initialized',
      });
    }
  });

  /**
   * GET /api/v1/ws/dedup-stats
   * Get deduplication statistics (rate limit prevention)
   */
  fastify.get('/api/v1/ws/dedup-stats', { preHandler: statsGuard || undefined }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const gateway = WebSocketGateway.getInstance();
      const deduplicator = gateway.getDeduplicator();
      const stats = deduplicator.getDetailedStats();

      return reply.send({
        success: true,
        data: stats,
        recommendations: generateRecommendations(stats),
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Dedup Stats] Error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve deduplication stats',
      });
    }
  });

  /**
   * GET /api/v1/ws/rate-limits
   * Get rate limit usage for all external services
   */
  fastify.get('/api/v1/ws/rate-limits', { preHandler: statsGuard || undefined }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const gateway = WebSocketGateway.getInstance();
      const rateLimitMonitor = gateway.getRateLimitMonitor();
      const usage = rateLimitMonitor.getAllUsage();
      const alerts = rateLimitMonitor.getAlerts(10);

      return reply.send({
        success: true,
        data: {
          usage,
          alerts,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Rate Limit Stats] Error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve rate limit stats',
      });
    }
  });

  /**
   * GET /api/v1/ws/adapter-status
   * Get adapter connection status (QuickNode, Goldsky, BitQuery, Aerodrome)
   */
  fastify.get('/api/v1/ws/adapter-status', { preHandler: statsGuard || undefined }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const adapterManager = (fastify as any).adapterManager;
      
      if (!adapterManager) {
        return reply.code(503).send({
          success: false,
          error: 'AdapterManager not initialized',
        });
      }

      const stats = adapterManager.getAllStats();

      return reply.send({
        success: true,
        data: {
          adapters: {
            quickNode: {
              connected: adapterManager.getAdapter('quicknode').isConnected(),
              stats: stats.quickNode,
            },
            goldsky: {
              connected: adapterManager.getAdapter('goldsky').isConnected(),
              stats: stats.goldsky,
            },
            aerodrome: {
              connected: adapterManager.getAdapter('aerodrome').isConnected(),
              stats: stats.aerodrome,
            },
          },
          overall: {
            coreConnected: adapterManager.isConnected(),
          },
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Adapter Status] Error:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve adapter status',
      });
    }
  });
  fastify.get('/api/v1/ws/connections', { preHandler: statsGuard || undefined }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const gateway = WebSocketGateway.getInstance();
      const connectionManager = gateway.getConnectionManager();
      const clients = connectionManager.getAllClients();

      const clientInfo = clients.map((client) => ({
        id: client.id,
        connectedAt: client.connectedAt,
        subscriptionCount: client.subscriptions.size,
        metadata: client.metadata,
      }));

      return reply.send({
        success: true,
        data: {
          total: clients.length,
          clients: clientInfo,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[Connections] Error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve connections',
      });
    }
  });
}

/**
 * Generate recommendations based on dedup stats
 */
function generateRecommendations(stats: any): string[] {
  const recommendations: string[] = [];

  if (stats.dedupRatio < 5) {
    recommendations.push(
      `Low deduplication ratio (${stats.dedupRatio.toFixed(1)}x). Most clients watch different tokens.`,
    );
  } else if (stats.dedupRatio > 100) {
    recommendations.push(
      `Excellent deduplication! ${stats.dedupRatio.toFixed(1)}x reduction in external API calls.`,
    );
  }

  if (stats.externalSubscriptions === 0) {
    recommendations.push('No active external subscriptions. System is idle.');
  }

  if (stats.savings.savingsPercentage > 90) {
    recommendations.push(
      `🎉 Saving ${stats.savings.savingsPercentage.toFixed(1)}% on external API calls! ` +
        `(${stats.savings.savedRequests} requests saved)`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All systems operating normally.');
  }

  return recommendations;
}

