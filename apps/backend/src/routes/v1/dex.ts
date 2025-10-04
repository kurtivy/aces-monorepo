import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ethers } from 'ethers';

import {
  AerodromeDataService,
  AerodromePoolState,
  AerodromeSwap,
} from '../../services/aerodrome-data-service';
import { createProvider, getNetworkConfig } from '../../config/network.config';

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

interface AddressParams {
  address: string;
}

interface CandlesQuery {
  resolution?: string;
  lookbackMinutes?: number;
}

interface TradesQuery {
  limit?: number;
}

interface QuoteQuery {
  inputAsset?: string;
  amount?: string;
  slippageBps?: string;
}

interface QuoteResponse {
  inputAsset: string;
  inputAmount: string;
  inputAmountRaw: string;
  expectedOutput: string;
  expectedOutputRaw: string;
  minOutput: string;
  minOutputRaw: string;
  slippageBps: number;
  path: string[];
  intermediate?: Array<{ symbol: string; amount: string }>;
}

export async function dexRoutes(fastify: FastifyInstance) {
  const mainnetConfig = getNetworkConfig(8453);
  const provider = createProvider(8453);
  const mockEnabled =
    process.env.USE_DEX_MOCKS === 'true' ||
    !mainnetConfig.rpcUrl ||
    !mainnetConfig.aerodromeFactory ||
    !mainnetConfig.aerodromeRouter;

  let aerodromeService: AerodromeDataService | null = null;

  try {
    aerodromeService = new AerodromeDataService({
      provider: provider ?? undefined,
      rpcUrl: provider ? undefined : mainnetConfig.rpcUrl,
      factoryAddress: mainnetConfig.aerodromeFactory,
      acesTokenAddress: mainnetConfig.acesToken,
      apiBaseUrl: process.env.AERODROME_API_BASE_URL,
      apiKey: process.env.AERODROME_API_KEY,
      defaultStable: process.env.AERODROME_DEFAULT_STABLE === 'true',
      mockEnabled,
    });
  } catch (error) {
    fastify.log.error({ err: error }, 'Failed to initialize AerodromeDataService');
  }

  const ensureService = (): AerodromeDataService => {
    if (!aerodromeService) {
      throw new Error('Aerodrome data service unavailable');
    }
    return aerodromeService;
  };

  const assetMetadata = {
    ACES: {
      symbol: 'ACES',
      address: mainnetConfig.acesToken.toLowerCase(),
      decimals: 18,
    },
    USDC: {
      symbol: 'USDC',
      address: (
        process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C0b43d5Ee1fCD46a7B3'
      ).toLowerCase(),
      decimals: Number(process.env.AERODROME_USDC_DECIMALS || 6),
    },
    ETH: {
      symbol: 'ETH',
      address: (
        process.env.WETH_ADDRESS || '0x4200000000000000000000000000000000000006'
      ).toLowerCase(),
      decimals: Number(process.env.AERODROME_WETH_DECIMALS || 18),
    },
  } as const;

  const decimalsCache = new Map<string, number>();

  const getTokenDecimals = async (tokenAddress: string): Promise<number> => {
    const normalized = tokenAddress.toLowerCase();
    const cached = decimalsCache.get(normalized);
    if (cached !== undefined) {
      return cached;
    }

    if (!provider) {
      throw new Error('Provider unavailable for decimals lookup');
    }

    const contract = new ethers.Contract(
      normalized,
      ['function decimals() view returns (uint8)'],
      provider,
    );
    const value = Number(await contract.decimals());
    decimalsCache.set(normalized, value);
    return value;
  };

  const computeSwap = (amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint => {
    if (reserveIn === 0n || reserveOut === 0n) {
      return 0n;
    }

    const feeNumerator = 997n; // approx 0.3% fee assumption
    const feeDenominator = 1000n;
    const amountInWithFee = (amountIn * feeNumerator) / feeDenominator;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    return denominator === 0n ? 0n : numerator / denominator;
  };

  fastify.get(
    '/:address/pool',
    {
      schema: {
        params: zodToJsonSchema(z.object({ address: addressSchema })),
      },
    },
    async (request: FastifyRequest<{ Params: AddressParams }>, reply) => {
      try {
        const service = ensureService();
        const poolState: AerodromePoolState | null = await service.getPoolState(
          request.params.address,
        );

        if (!poolState) {
          return reply.code(404).send({ success: false, error: 'Pool not found' });
        }

        return reply.send({ success: true, data: poolState });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch pool state');
        return reply.code(503).send({ success: false, error: 'Dex service unavailable' });
      }
    },
  );

  fastify.get(
    '/:address/quote',
    {
      schema: {
        params: zodToJsonSchema(z.object({ address: addressSchema })),
        querystring: zodToJsonSchema(
          z.object({
            inputAsset: z.string().optional(),
            amount: z.string().optional(),
            slippageBps: z.string().optional(),
          }),
        ),
      },
    },
    async (request: FastifyRequest<{ Params: AddressParams; Querystring: QuoteQuery }>, reply) => {
      try {
        const service = ensureService();

        const inputAssetCode = (request.query.inputAsset || 'ACES').toUpperCase();
        const amountStr = request.query.amount ?? '0';
        const slippageBps = Number(request.query.slippageBps ?? '100');

        const assetConfig = assetMetadata[inputAssetCode as keyof typeof assetMetadata];
        if (!assetConfig) {
          return reply.code(400).send({
            success: false,
            error: `Unsupported input asset: ${inputAssetCode}`,
          });
        }

        const amount = Number(amountStr);
        if (!Number.isFinite(amount) || amount <= 0) {
          return reply.code(400).send({ success: false, error: 'Invalid amount' });
        }

        const normalizedToken = request.params.address.toLowerCase();
        const tokenDecimals = await getTokenDecimals(normalizedToken);
        const amountInRaw = ethers.parseUnits(amountStr, assetConfig.decimals);

        const tokenPool = await service.getPoolState(normalizedToken);
        if (!tokenPool) {
          return reply.code(404).send({ success: false, error: 'Launchpad pool not found' });
        }

        let expectedOutputRaw = 0n;
        const intermediateSteps: Array<{ symbol: string; amount: string }> = [];

        if (assetConfig.symbol === 'ACES') {
          const reserveIn = BigInt(tokenPool.reserveRaw.counter);
          const reserveOut = BigInt(tokenPool.reserveRaw.token);
          expectedOutputRaw = computeSwap(amountInRaw, reserveIn, reserveOut);
        } else {
          const counterPool = await service.getPoolState(assetConfig.address);
          if (!counterPool) {
            return reply.code(404).send({ success: false, error: 'Route pool not found' });
          }

          const firstLegOut = computeSwap(
            amountInRaw,
            BigInt(counterPool.reserveRaw.token),
            BigInt(counterPool.reserveRaw.counter),
          );

          intermediateSteps.push({
            symbol: 'ACES',
            amount: ethers.formatUnits(firstLegOut, assetMetadata.ACES.decimals),
          });

          const reserveIn = BigInt(tokenPool.reserveRaw.counter);
          const reserveOut = BigInt(tokenPool.reserveRaw.token);
          expectedOutputRaw = computeSwap(firstLegOut, reserveIn, reserveOut);
        }

        if (expectedOutputRaw === 0n) {
          return reply.code(400).send({
            success: false,
            error: 'Insufficient liquidity for this trade size',
          });
        }

        const minOutputRaw = (expectedOutputRaw * BigInt(10_000 - slippageBps)) / 10_000n;

        const quote: QuoteResponse = {
          inputAsset: assetConfig.symbol,
          inputAmount: amountStr,
          inputAmountRaw: amountInRaw.toString(),
          expectedOutput: ethers.formatUnits(expectedOutputRaw, tokenDecimals),
          expectedOutputRaw: expectedOutputRaw.toString(),
          minOutput: ethers.formatUnits(minOutputRaw, tokenDecimals),
          minOutputRaw: minOutputRaw.toString(),
          slippageBps,
          path:
            assetConfig.symbol === 'ACES'
              ? [assetConfig.address, normalizedToken]
              : [assetConfig.address, assetMetadata.ACES.address, normalizedToken],
          intermediate: intermediateSteps.length ? intermediateSteps : undefined,
        };

        return reply.send({ success: true, data: quote });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to compute quote');
        return reply.code(503).send({ success: false, error: 'Dex service unavailable' });
      }
    },
  );

  fastify.get(
    '/:address/candles',
    {
      schema: {
        params: zodToJsonSchema(z.object({ address: addressSchema })),
        querystring: zodToJsonSchema(
          z
            .object({
              resolution: z.enum(['5m', '15m', '1h', '4h', '1d']).default('5m'),
              lookbackMinutes: z
                .string()
                .transform((value) => Number(value))
                .or(z.number())
                .optional(),
            })
            .partial(),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: AddressParams;
        Querystring: CandlesQuery;
      }>,
      reply,
    ) => {
      try {
        const service = ensureService();
        const { address } = request.params;
        const { resolution = '5m', lookbackMinutes = 60 } = request.query;

        const candles = await service.getCandles(address, resolution as any, lookbackMinutes);

        return reply.send({
          success: true,
          data: {
            resolution,
            candles,
          },
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch candles');
        return reply.code(503).send({ success: false, error: 'Dex service unavailable' });
      }
    },
  );

  fastify.get(
    '/:address/trades',
    {
      schema: {
        params: zodToJsonSchema(z.object({ address: addressSchema })),
        querystring: zodToJsonSchema(
          z.object({
            limit: z
              .string()
              .transform((value) => Number(value))
              .or(z.number())
              .default('100'),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: AddressParams;
        Querystring: TradesQuery;
      }>,
      reply,
    ) => {
      try {
        const service = ensureService();
        const { address } = request.params;
        const { limit = 100 } = request.query;

        const trades: AerodromeSwap[] = await service.getRecentTrades(address, limit);

        return reply.send({ success: true, data: trades });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch trades');
        return reply.code(503).send({ success: false, error: 'Dex service unavailable' });
      }
    },
  );
}
