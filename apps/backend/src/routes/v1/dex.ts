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
import { getPrismaClient } from '../../lib/database';

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
  routes: Array<{ from: string; to: string; stable: boolean }>;
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

  console.log('🔧 DEX Routes Initialization:');
  console.log(`   RPC URL: ${mainnetConfig.rpcUrl ? 'SET' : 'MISSING'}`);
  console.log(`   Factory: ${mainnetConfig.aerodromeFactory || 'MISSING'}`);
  console.log(`   Router: ${mainnetConfig.aerodromeRouter || 'MISSING'}`);
  console.log(`   ACES Token: ${mainnetConfig.acesToken}`);
  console.log(`   Provider created: ${provider ? 'YES' : 'NO'}`);
  console.log(`   Mock enabled: ${mockEnabled}`);

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
    console.log('✅ AerodromeDataService initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize AerodromeDataService:', error);
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
        process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
      ).toLowerCase(),
      decimals: Number(process.env.AERODROME_USDC_DECIMALS || 6),
    },
    USDT: {
      symbol: 'USDT',
      address: (
        process.env.USDT_ADDRESS || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
      ).toLowerCase(),
      decimals: Number(process.env.AERODROME_USDT_DECIMALS || 6),
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
        console.log('🔍 DEX QUOTE HANDLER CALLED - NEW CODE RUNNING');
        const service = ensureService();

        const inputAssetCode = (request.query.inputAsset || 'ACES').toUpperCase();
        const amountStr = request.query.amount ?? '0';
        const slippageBps = Number(request.query.slippageBps ?? '100');

        const amount = Number(amountStr);
        if (!Number.isFinite(amount) || amount <= 0) {
          return reply.code(400).send({ success: false, error: 'Invalid amount' });
        }

        const normalizedToken = request.params.address.toLowerCase();
        const tokenDecimals = await getTokenDecimals(normalizedToken);

        // Check if input is the launchpad token (for selling)
        const isSellMode = inputAssetCode === 'TOKEN';

        let assetConfig;
        let amountInRaw: bigint;

        if (isSellMode) {
          // Selling the launchpad token for ACES
          console.log('💰 SELL MODE: Selling launchpad token for ACES');
          amountInRaw = ethers.parseUnits(amountStr, tokenDecimals);
          assetConfig = null; // Not needed for sell mode
        } else {
          // Buying the launchpad token with ACES/USDC/ETH
          assetConfig = assetMetadata[inputAssetCode as keyof typeof assetMetadata];
          if (!assetConfig) {
            return reply.code(400).send({
              success: false,
              error: `Unsupported input asset: ${inputAssetCode}. Use 'TOKEN' to sell the launchpad token.`,
            });
          }
          amountInRaw = ethers.parseUnits(amountStr, assetConfig.decimals);
        }

        // Look up pool address from database
        const prisma = getPrismaClient();
        console.log(`🔍 Looking up token in DB: ${normalizedToken}`);
        const token = await prisma.token.findUnique({
          where: { contractAddress: normalizedToken },
          select: { poolAddress: true },
        });

        console.log(`📊 DEX Quote request for ${normalizedToken}`);
        console.log(`🏊 Pool address from DB: ${token?.poolAddress || 'null'}`);

        // Store the known pool address for routing
        const knownPoolAddress = token?.poolAddress ?? undefined;

        const tokenPool = await service.getPoolState(normalizedToken, knownPoolAddress);

        console.log(`✅ Pool state result: ${tokenPool ? 'FOUND' : 'NULL'}`);
        if (tokenPool) {
          console.log(
            `📈 Pool reserves - Token: ${tokenPool.reserveRaw?.token}, Counter: ${tokenPool.reserveRaw?.counter}`,
          );
        }

        if (!tokenPool) {
          console.log(
            `ℹ️ No direct TOKEN/ACES pool for ${normalizedToken}. Will try multi-hop via WETH. DB pool: ${knownPoolAddress}`,
          );
        }

        let expectedOutputRaw = 0n;
        const intermediateSteps: Array<{ symbol: string; amount: string }> = [];
        let outputDecimals: number = tokenDecimals;
        let outputSymbol = 'TOKEN';
        let routePath: string[] = [];
        const routes: Array<{ from: string; to: string; stable: boolean }> = [];

        if (isSellMode) {
          // Selling launchpad token for ACES
          console.log('💸 Computing sell: TOKEN -> ACES');

          const tokenToAces = await service.getPairReserves(
            normalizedToken,
            assetMetadata.ACES.address,
            knownPoolAddress,
          );

          if (tokenToAces) {
            expectedOutputRaw = computeSwap(
              amountInRaw,
              tokenToAces.reserveIn,
              tokenToAces.reserveOut,
            );
            outputDecimals = 18; // ACES
            outputSymbol = 'ACES';
            routePath = [normalizedToken, assetMetadata.ACES.address];
            routes.push({
              from: normalizedToken,
              to: assetMetadata.ACES.address,
              stable: Boolean(tokenToAces.stable),
            });
          } else {
            console.log('🔁 Falling back to TOKEN -> WETH -> ACES');
            const tokenToWeth = await service.getPairReserves(
              normalizedToken,
              assetMetadata.ETH.address,
            );
            const envAcesWeth = process.env.AERODROME_ACES_WETH_POOL || '';
            const knownAcesWethPool = envAcesWeth ? envAcesWeth.toLowerCase() : undefined;
            const wethToAces = await service.getPairReserves(
              assetMetadata.ETH.address,
              assetMetadata.ACES.address,
              knownAcesWethPool,
            );

            if (!tokenToWeth || !wethToAces) {
              return reply.code(404).send({ success: false, error: 'Route pool not found' });
            }

            const wethAmountRaw = computeSwap(
              amountInRaw,
              tokenToWeth.reserveIn,
              tokenToWeth.reserveOut,
            );
            expectedOutputRaw = computeSwap(
              wethAmountRaw,
              wethToAces.reserveIn,
              wethToAces.reserveOut,
            );
            outputDecimals = 18; // ACES
            outputSymbol = 'ACES';
            routePath = [normalizedToken, assetMetadata.ETH.address, assetMetadata.ACES.address];
            routes.push({
              from: normalizedToken,
              to: assetMetadata.ETH.address,
              stable: Boolean(tokenToWeth.stable),
            });
            routes.push({
              from: assetMetadata.ETH.address,
              to: assetMetadata.ACES.address,
              stable: Boolean(wethToAces.stable),
            });
          }
        } else if (assetConfig!.symbol === 'ACES') {
          // Buying launchpad token with ACES
          console.log('💸 Computing buy: ACES -> TOKEN');

          // Prefer direct ACES/TOKEN pool, else fallback ACES->WETH->TOKEN
          const directAcesToToken = await service.getPairReserves(
            assetMetadata.ACES.address,
            normalizedToken,
            knownPoolAddress,
          );

          if (directAcesToToken) {
            expectedOutputRaw = computeSwap(
              amountInRaw,
              directAcesToToken.reserveIn,
              directAcesToToken.reserveOut,
            );
            outputDecimals = tokenDecimals;
            outputSymbol = 'TOKEN';
            routePath = [assetMetadata.ACES.address, normalizedToken];
            routes.push({
              from: assetMetadata.ACES.address,
              to: normalizedToken,
              stable: Boolean(directAcesToToken.stable),
            });
          } else {
            console.log('🔁 Falling back to ACES -> WETH -> TOKEN');
            const acesToWeth = await service.getPairReserves(
              assetMetadata.ACES.address,
              assetMetadata.ETH.address,
            );
            const wethToToken = await service.getPairReserves(
              assetMetadata.ETH.address,
              normalizedToken,
              knownPoolAddress,
            );

            if (!acesToWeth || !wethToToken) {
              return reply.code(404).send({ success: false, error: 'Route pool not found' });
            }

            const wethAmountRaw = computeSwap(
              amountInRaw,
              acesToWeth.reserveIn,
              acesToWeth.reserveOut,
            );

            intermediateSteps.push({
              symbol: 'wETH',
              amount: ethers.formatUnits(wethAmountRaw, assetMetadata.ETH.decimals),
            });

            expectedOutputRaw = computeSwap(
              wethAmountRaw,
              wethToToken.reserveIn,
              wethToToken.reserveOut,
            );
            outputDecimals = tokenDecimals;
            outputSymbol = 'TOKEN';
            routePath = [assetMetadata.ACES.address, assetMetadata.ETH.address, normalizedToken];
            routes.push({
              from: assetMetadata.ACES.address,
              to: assetMetadata.ETH.address,
              stable: Boolean(acesToWeth.stable),
            });
            routes.push({
              from: assetMetadata.ETH.address,
              to: normalizedToken,
              stable: Boolean(wethToToken.stable),
            });
          }
        } else if (assetConfig!.symbol === 'ETH') {
          console.log('💸 Computing buy: wETH path');

          // Prefer direct WETH -> TOKEN if pool exists
          const wethToToken = await service.getPairReserves(
            assetMetadata.ETH.address,
            normalizedToken,
            knownPoolAddress,
          );

          if (wethToToken) {
            expectedOutputRaw = computeSwap(
              amountInRaw,
              wethToToken.reserveIn,
              wethToToken.reserveOut,
            );
            outputDecimals = tokenDecimals;
            outputSymbol = 'TOKEN';
            routePath = [assetMetadata.ETH.address, normalizedToken];
            routes.push({
              from: assetMetadata.ETH.address,
              to: normalizedToken,
              stable: Boolean(wethToToken.stable),
            });
          } else {
            // Fallback: WETH -> ACES -> TOKEN if ACES/TOKEN exists
            // Note: Aerodrome pool is ACES/WETH (in that order), but we query WETH->ACES for the swap direction
            console.log('🔄 Attempting WETH -> ACES -> TOKEN routing...');
            console.log(`  WETH address: ${assetMetadata.ETH.address}`);
            console.log(`  ACES address: ${assetMetadata.ACES.address}`);
            console.log(`  TOKEN address: ${normalizedToken}`);
            console.log(`  Known pool address: ${knownPoolAddress || 'none'}`);

            // Query WETH -> ACES (we're swapping WETH for ACES)
            // Prefer known ACES/WETH pool address if provided via env
            const envAcesWeth2 = process.env.AERODROME_ACES_WETH_POOL || '';
            const knownAcesWethPool = envAcesWeth2 ? envAcesWeth2.toLowerCase() : undefined;
            const wethToAces = await service.getPairReserves(
              assetMetadata.ETH.address,
              assetMetadata.ACES.address,
              knownAcesWethPool,
            );
            console.log(`  WETH->ACES pool result: ${wethToAces ? 'FOUND' : 'NOT FOUND'}`);
            if (wethToAces) {
              console.log(`    Pool address: ${wethToAces.poolAddress}`);
              console.log(`    Reserve in (WETH): ${wethToAces.reserveIn}`);
              console.log(`    Reserve out (ACES): ${wethToAces.reserveOut}`);
            }

            // Query ACES -> TOKEN (we're swapping ACES for TOKEN)
            const acesToToken = await service.getPairReserves(
              assetMetadata.ACES.address,
              normalizedToken,
              knownPoolAddress,
            );
            console.log(`  ACES->TOKEN pool result: ${acesToToken ? 'FOUND' : 'NOT FOUND'}`);
            if (acesToToken) {
              console.log(`    Pool address: ${acesToToken.poolAddress}`);
              console.log(`    Reserve in (ACES): ${acesToToken.reserveIn}`);
              console.log(`    Reserve out (TOKEN): ${acesToToken.reserveOut}`);
            }

            if (!wethToAces || !acesToToken) {
              const missingPool = !wethToAces ? 'WETH/ACES' : 'ACES/TOKEN';
              console.error(`❌ Missing pool: ${missingPool}`);
              return reply.code(404).send({
                success: false,
                error: `Route pool not found: ${missingPool} pool is missing. ${!acesToToken ? 'Token may not be bonded yet.' : ''}`,
              });
            }

            // Calculate WETH -> ACES swap
            const acesAmountRaw = computeSwap(
              amountInRaw,
              wethToAces.reserveIn,
              wethToAces.reserveOut,
            );
            console.log(`  Intermediate ACES amount: ${ethers.formatUnits(acesAmountRaw, 18)}`);

            intermediateSteps.push({
              symbol: 'ACES',
              amount: ethers.formatUnits(acesAmountRaw, assetMetadata.ACES.decimals),
            });

            // Calculate ACES -> TOKEN swap
            expectedOutputRaw = computeSwap(
              acesAmountRaw,
              acesToToken.reserveIn,
              acesToToken.reserveOut,
            );
            console.log(
              `  Final TOKEN amount: ${ethers.formatUnits(expectedOutputRaw, tokenDecimals)}`,
            );

            outputDecimals = tokenDecimals;
            outputSymbol = 'TOKEN';
            routePath = [assetMetadata.ETH.address, assetMetadata.ACES.address, normalizedToken];
            routes.push({
              from: assetMetadata.ETH.address,
              to: assetMetadata.ACES.address,
              stable: Boolean(wethToAces.stable),
            });
            routes.push({
              from: assetMetadata.ACES.address,
              to: normalizedToken,
              stable: Boolean(acesToToken.stable),
            });
          }
        } else if (assetConfig!.symbol === 'USDC' || assetConfig!.symbol === 'USDT') {
          console.log(`💸 Computing buy: ${assetConfig!.symbol} path`);

          const stableToWeth = await service.getPairReserves(
            assetConfig!.address,
            assetMetadata.ETH.address,
          );
          if (!stableToWeth) {
            return reply.code(404).send({ success: false, error: 'Route pool not found' });
          }

          const wethAmountRaw = computeSwap(
            amountInRaw,
            stableToWeth.reserveIn,
            stableToWeth.reserveOut,
          );

          // Prefer direct WETH->TOKEN after stable->WETH
          const wethToToken = await service.getPairReserves(
            assetMetadata.ETH.address,
            normalizedToken,
            knownPoolAddress,
          );
          if (wethToToken) {
            expectedOutputRaw = computeSwap(
              wethAmountRaw,
              wethToToken.reserveIn,
              wethToToken.reserveOut,
            );
            outputDecimals = tokenDecimals;
            outputSymbol = 'TOKEN';
            routePath = [assetConfig!.address, assetMetadata.ETH.address, normalizedToken];
            routes.push({
              from: assetConfig!.address,
              to: assetMetadata.ETH.address,
              stable: Boolean(stableToWeth.stable),
            });
            routes.push({
              from: assetMetadata.ETH.address,
              to: normalizedToken,
              stable: Boolean(wethToToken.stable),
            });
          } else {
            // Fallback through ACES only if WETH->TOKEN missing
            const envAcesWeth3 = process.env.AERODROME_ACES_WETH_POOL || '';
            const knownAcesWethPool2 = envAcesWeth3 ? envAcesWeth3.toLowerCase() : undefined;
            const wethToAces = await service.getPairReserves(
              assetMetadata.ETH.address,
              assetMetadata.ACES.address,
              knownAcesWethPool2,
            );
            const acesToToken = await service.getPairReserves(
              assetMetadata.ACES.address,
              normalizedToken,
              knownPoolAddress,
            );
            if (!wethToAces || !acesToToken) {
              return reply.code(404).send({ success: false, error: 'Route pool not found' });
            }
            const acesAmountRaw = computeSwap(
              wethAmountRaw,
              wethToAces.reserveIn,
              wethToAces.reserveOut,
            );
            expectedOutputRaw = computeSwap(
              acesAmountRaw,
              acesToToken.reserveIn,
              acesToToken.reserveOut,
            );
            outputDecimals = tokenDecimals;
            outputSymbol = 'TOKEN';
            routePath = [
              assetConfig!.address,
              assetMetadata.ETH.address,
              assetMetadata.ACES.address,
              normalizedToken,
            ];
            routes.push({
              from: assetConfig!.address,
              to: assetMetadata.ETH.address,
              stable: Boolean(stableToWeth.stable),
            });
            routes.push({
              from: assetMetadata.ETH.address,
              to: assetMetadata.ACES.address,
              stable: Boolean(wethToAces.stable),
            });
            routes.push({
              from: assetMetadata.ACES.address,
              to: normalizedToken,
              stable: Boolean(acesToToken.stable),
            });
          }
        } else {
          // Fallback: direct multi-hop via ACES if configured
          const counterPool = await service.getPoolState(assetConfig!.address);
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

          // Compute ACES -> TOKEN using direct pair reserves (tokenPool may be null)
          const acesToToken3 = await service.getPairReserves(
            assetMetadata.ACES.address,
            normalizedToken,
            knownPoolAddress,
          );
          if (!acesToToken3) {
            return reply.code(404).send({ success: false, error: 'Route pool not found' });
          }
          expectedOutputRaw = computeSwap(
            firstLegOut,
            acesToToken3.reserveIn,
            acesToToken3.reserveOut,
          );
          outputDecimals = tokenDecimals;
          outputSymbol = 'TOKEN';
          routePath = [assetConfig!.address, assetMetadata.ACES.address, normalizedToken];
          const counterToAces = await service.getPairReserves(
            assetConfig!.address,
            assetMetadata.ACES.address,
          );
          routes.push({
            from: assetConfig!.address,
            to: assetMetadata.ACES.address,
            stable: Boolean(counterToAces?.stable),
          });
          routes.push({
            from: assetMetadata.ACES.address,
            to: normalizedToken,
            stable: Boolean(acesToToken3?.stable),
          });
        }

        if (expectedOutputRaw === 0n) {
          return reply.code(400).send({
            success: false,
            error: 'Insufficient liquidity for this trade size',
          });
        }

        const minOutputRaw = (expectedOutputRaw * BigInt(10_000 - slippageBps)) / 10_000n;

        const quote: QuoteResponse = {
          inputAsset: isSellMode ? 'TOKEN' : assetConfig!.symbol,
          inputAmount: amountStr,
          inputAmountRaw: amountInRaw.toString(),
          expectedOutput: ethers.formatUnits(expectedOutputRaw, outputDecimals),
          expectedOutputRaw: expectedOutputRaw.toString(),
          minOutput: ethers.formatUnits(minOutputRaw, outputDecimals),
          minOutputRaw: minOutputRaw.toString(),
          slippageBps,
          path: routePath,
          routes,
          intermediate: intermediateSteps.length ? intermediateSteps : undefined,
        };

        return reply.send({ success: true, data: quote });
      } catch (error) {
        console.error('❌ ERROR in DEX quote handler:', error);
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

        const candles = await service.getCandles(
          address,
          resolution as '5m' | '15m' | '1h' | '4h' | '1d',
          lookbackMinutes,
        );

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
        const { address } = request.params;
        const { limit = 100 } = request.query;

        // First, check if token has bonded to DEX (has poolAddress)
        const token = await fastify.prisma.token.findUnique({
          where: { contractAddress: address.toLowerCase() },
          select: {
            poolAddress: true,
            phase: true,
            priceSource: true,
          },
        });

        if (!token?.poolAddress || token.phase !== 'DEX_TRADING') {
          // Not on DEX yet, return empty array
          return reply.send({ success: true, data: [] });
        }

        // Use BitQuery to get DEX trades
        const { BitQueryService } = await import('../../services/bitquery-service');
        const bitquery = new BitQueryService();

        console.log(
          `[DEX Trades] Fetching BitQuery trades for ${address} via pool ${token.poolAddress}`,
        );

        const swaps = await bitquery.getRecentSwaps(address, token.poolAddress, {
          limit: Number(limit),
        });

        console.log(`[DEX Trades] Found ${swaps.length} trades from BitQuery`);

        // Transform BitQuery format to match expected frontend format
        const trades = swaps.map((swap) => ({
          txHash: swap.txHash,
          timestamp: new Date(swap.blockTime).getTime(),
          direction: swap.side as 'buy' | 'sell',
          amountToken: swap.amountToken,
          amountCounter: swap.amountAces,
          priceInCounter: parseFloat(swap.priceInAces),
          priceInUsd: parseFloat(swap.priceInUsd) || undefined,
          volumeUsd: swap.volumeUsd,
          blockNumber: swap.blockNumber,
          trader: swap.sender, // Address of the trader who made the swap
        }));

        return reply.send({ success: true, data: trades });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch trades');
        return reply.code(503).send({ success: false, error: 'Dex service unavailable' });
      }
    },
  );
}
