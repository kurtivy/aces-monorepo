import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

interface TwitchStreamParams {
  channelName: string;
}

interface TwitchAnalyticsBody {
  action: string;
  windowState?: Record<string, unknown>;
  timestamp: string;
}

export async function twitchRoutes(fastify: FastifyInstance) {
  // Get stream status endpoint
  fastify.get(
    '/stream-status/:channelName',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            channelName: z.string().min(1).max(50),
          }),
        ),
        response: {
          200: zodToJsonSchema(
            z.object({
              success: z.boolean(),
              data: z.object({
                isLive: z.boolean(),
                streamData: z.record(z.unknown()).nullable(),
              }),
            }),
          ),
        },
      },
    },
    async (request: FastifyRequest<{ Params: TwitchStreamParams }>, reply) => {
      try {
        const { channelName } = request.params;

        // Validate environment variables
        if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
          fastify.log.error('Twitch API credentials not configured');
          return reply.code(500).send({
            success: false,
            error: 'Twitch API not configured',
          });
        }

        // Get OAuth token first
        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials',
          }),
        });

        if (!tokenResponse.ok) {
          fastify.log.error('Failed to get Twitch OAuth token');
          return reply.code(500).send({
            success: false,
            error: 'Failed to authenticate with Twitch API',
          });
        }

        const tokenData = (await tokenResponse.json()) as { access_token: string };

        // Check stream status
        const streamResponse = await fetch(
          `https://api.twitch.tv/helix/streams?user_login=${channelName}`,
          {
            headers: {
              'Client-ID': process.env.TWITCH_CLIENT_ID,
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          },
        );

        if (!streamResponse.ok) {
          fastify.log.error('Failed to fetch stream data from Twitch');
          return reply.code(500).send({
            success: false,
            error: 'Failed to fetch stream data',
          });
        }

        const streamData = (await streamResponse.json()) as {
          data: Array<Record<string, unknown>>;
        };

        return reply.send({
          success: true,
          data: {
            isLive: streamData.data.length > 0,
            streamData: streamData.data[0] || null,
          },
        });
      } catch (error) {
        fastify.log.error({ error }, 'Twitch stream status error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to check stream status',
        });
      }
    },
  );

  // Analytics tracking endpoint
  fastify.post(
    '/analytics',
    {
      schema: {
        body: zodToJsonSchema(
          z.object({
            action: z.string(),
            windowState: z.record(z.unknown()).optional(),
            timestamp: z.string(),
          }),
        ),
        response: {
          200: zodToJsonSchema(
            z.object({
              success: z.boolean(),
            }),
          ),
        },
      },
    },
    async (request: FastifyRequest<{ Body: TwitchAnalyticsBody }>, reply) => {
      try {
        const { action, windowState, timestamp } = request.body;

        // Log to your database or external service
        fastify.log.info(
          {
            action,
            windowState,
            timestamp,
          },
          'Twitch Stream Analytics',
        );

        // TODO: Store in database if needed
        // await fastify.prisma.twitchAnalytics.create({
        //   data: { action, windowState, timestamp }
        // });

        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error({ error }, 'Twitch analytics error');
        return reply.code(500).send({
          success: false,
          error: 'Failed to track analytics',
        });
      }
    },
  );
}
