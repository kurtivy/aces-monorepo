import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ethers } from 'ethers';

import {
  AerodromeDataService,
  AerodromePoolState,
  // AerodromeSwap,
} from '../../services/aerodrome-data-service';
import { BitQueryService } from '../../services/bitquery-service';
import { createProvider, getNetworkConfig } from '../../config/network.config';
import { getPrismaClient } from '../../lib/database';
import { SubgraphTrade } from '../../lib/goldsky-client';

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
  inputUsdValue?: string;
  outputUsdValue?: string;
  prices?: {
    aces?: number;
    weth?: number;
    usdc?: number;
    usdt?: number;
  };
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
    // 🔥 PHASE 3: Pass fastify instance to service for cache plugin access
    aerodromeService = new AerodromeDataService({
      provider: provider ?? undefined,
      rpcUrl: provider ? undefined : mainnetConfig.rpcUrl,
      factoryAddress: mainnetConfig.aerodromeFactory,
      acesTokenAddress: mainnetConfig.acesToken,
      apiBaseUrl: process.env.AERODROME_API_BASE_URL,
      apiKey: process.env.AERODROME_API_KEY,
      defaultStable: process.env.AERODROME_DEFAULT_STABLE === 'true',
      mockEnabled,
      fastify, // 🔥 PHASE 3: Pass fastify instance for cache plugin
    });
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

  // 🔥 LOAD TEST FIX: Asset metadata with ETH/WETH aliasing
  // Note: ETH and WETH are the same token on Base L2 (0x4200000000000000000000000000000000000006)
  // We support both "ETH" and "WETH" as input to handle various frontend naming conventions
  const wethAddress = (
    process.env.WETH_ADDRESS || '0x4200000000000000000000000000000000000006'
  ).toLowerCase();
  const wethDecimals = Number(process.env.AERODROME_WETH_DECIMALS || 18);

  // 🔥 QUICK WIN #2: Request coalescing for trades endpoint
  const dexTradesCache = new Map<string, { data: any; timestamp: number }>();
  const dexTradesPendingRequests = new Map<string, Promise<any>>();
  const DEX_TRADES_CACHE_TTL_MS = 180000; // 3 minutes (trades don't change much)

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
      address: wethAddress,
      decimals: wethDecimals,
    },
    // 🔥 LOAD TEST FIX: WETH alias for ETH (same token on Base L2)
    WETH: {
      symbol: 'WETH',
      address: wethAddress,
      decimals: wethDecimals,
    },
  } as const;

  const decimalsCache = new Map<string, number>();

  // 🔥 LOAD TEST FIX: Caching for DEX candles (30s TTL)
  interface CandleCacheEntry {
    data: any;
    timestamp: number;
  }
  const candleCache = new Map<string, CandleCacheEntry>();
  const CANDLE_CACHE_TTL_MS = 30000; // 30 seconds

  // 🔥 LOAD TEST FIX: Request coalescing map for candles
  const candleRequestMap = new Map<string, Promise<any>>();

  // 🔥 LOAD TEST FIX: Request coalescing map for quotes
  const quoteRequestMap = new Map<string, Promise<QuoteResponse>>();

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
        const poolAddress = request.params.address;
        const { token: tokenAddress } = request.query as { token?: string };

        // Try WebSocket cached data first (real-time)
        if (fastify.adapterManager && tokenAddress) {
          const cachedPoolState = fastify.adapterManager.getCachedPoolState(poolAddress);
          if (cachedPoolState) {
            console.log('[DEX:Pool] ✅ Serving from WebSocket cache:', poolAddress);
            return reply.send({
              success: true,
              data: {
                poolAddress: cachedPoolState.poolAddress,
                reserve0: cachedPoolState.reserve0,
                reserve1: cachedPoolState.reserve1,
                priceToken0: cachedPoolState.priceToken0,
                priceToken1: cachedPoolState.priceToken1,
                blockNumber: cachedPoolState.blockNumber,
                timestamp: cachedPoolState.timestamp,
                lastUpdated: Date.now(),
                dataSource: 'websocket',
              },
            });
          }

          // No cache yet - start a background subscription to populate it
          console.log('[DEX:Pool] 🚀 Starting background WebSocket subscription for:', poolAddress);
          fastify.adapterManager
            .subscribeToPoolState(poolAddress, tokenAddress, (poolState) => {
              console.log('[DEX:Pool] 📊 Background pool update received:', poolAddress);
              // Data is auto-cached in the adapter
            })
            .catch((err) => {
              console.error('[DEX:Pool] ⚠️ Failed to start background subscription:', err);
            });

          console.log('[DEX:Pool] ⚠️ No WebSocket cache yet, falling back to RPC:', poolAddress);
        }

        // Fallback to old AerodromeDataService (RPC polling)
        if (!aerodromeService) {
          console.error('[DEX:Pool] ❌ AerodromeDataService not initialized');
          return reply.code(503).send({
            success: false,
            error: 'Dex service unavailable - AerodromeDataService not initialized',
            details: 'Check RPC configuration and environment variables',
          });
        }

        let poolState: AerodromePoolState | null = null;
        try {
          poolState = await aerodromeService.getPoolState(poolAddress);
        } catch (rpcError: any) {
          // Handle contract call errors gracefully
          const errorMessage = rpcError?.message || 'Unknown RPC error';
          const isCallException =
            errorMessage.includes('CALL_EXCEPTION') ||
            errorMessage.includes('missing revert data') ||
            rpcError?.code === 'CALL_EXCEPTION' ||
            rpcError?.reason === 'missing revert data';

          if (isCallException) {
            // Pool might not exist or contract call failed - return 404 instead of 503
            console.warn(
              `[DEX:Pool] ⚠️ Pool contract call failed for ${poolAddress}:`,
              errorMessage,
            );
            return reply.code(404).send({
              success: false,
              error: 'Pool not found or invalid',
              details:
                'The pool address may not exist or the contract call failed. This is normal for tokens that have not yet created a pool.',
            });
          }

          // Re-throw other errors to be caught by outer catch
          throw rpcError;
        }

        if (!poolState) {
          return reply.code(404).send({ success: false, error: 'Pool not found' });
        }

        return reply.send({ success: true, data: poolState });
      } catch (error) {
        console.error('[DEX:Pool] ❌ Error fetching pool state:', error);
        fastify.log.error({ err: error }, 'Failed to fetch pool state');

        // Check if it's already a handled error (404 response)
        if (error && typeof error === 'object' && 'statusCode' in error) {
          throw error; // Re-throw Fastify response objects
        }

        return reply.code(503).send({
          success: false,
          error: 'Dex service unavailable',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
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
        // 🔥 LOAD TEST FIX: Normalize WETH -> ETH immediately
        // This ensures all logic checking for "ETH" automatically works for "WETH"
        let inputAssetCode = (request.query.inputAsset || 'ACES').toUpperCase();
        if (inputAssetCode === 'WETH') {
          inputAssetCode = 'ETH';
        }

        const amountStr = request.query.amount ?? '0';
        const slippageBps = Number(request.query.slippageBps ?? '100');

        const amount = Number(amountStr);
        if (!Number.isFinite(amount) || amount <= 0) {
          return reply.code(400).send({ success: false, error: 'Invalid amount' });
        }

        const normalizedToken = request.params.address.toLowerCase();

        // 🔥 PHASE 4: Use global cache with getOrFetch pattern for quotes
        const CACHE_TTL = 3000; // 🔥 PHASE 4: 3 seconds (quotes change frequently, need fresher data)
        const cacheKey = `${normalizedToken}:${inputAssetCode}:${amountStr}:${slippageBps}`;

        // Track cache stats before to determine if this is a hit
        const statsBefore = fastify.cache?.getStats() || { hits: 0, misses: 0 };

        if (!fastify.cache) {
          throw new Error('Cache plugin not initialized');
        }

        // 🔥 LOAD TEST FIX: Request Coalescing for Quotes
        // Join in-flight requests for the same quote to prevent RPC stampedes
        let quotePromise = quoteRequestMap.get(cacheKey);
        let isCoalesced = false;

        if (quotePromise) {
          isCoalesced = true;
          // console.log(`[DEX Quote] 🤝 Joining pending request for ${cacheKey}`);
        } else {
          quotePromise = fastify.cache.getOrFetch<QuoteResponse>(
            'quotes',
            cacheKey,
            async () => {
              console.log('🔍 DEX QUOTE HANDLER CALLED - NEW CODE RUNNING');
              const service = ensureService();
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
                // Buying the launchpad token with ACES/USDC/ETH/WETH
                assetConfig = assetMetadata[inputAssetCode as keyof typeof assetMetadata];
                if (!assetConfig) {
                  const supportedAssets = Object.keys(assetMetadata).join(', ');
                  fastify.log.warn(
                    { inputAsset: inputAssetCode, supportedAssets },
                    'Unsupported input asset requested',
                  );
                  throw new Error(
                    `Unsupported input asset: ${inputAssetCode}. Supported assets: ${supportedAssets}, TOKEN (to sell the launchpad token).`,
                  );
                }
                amountInRaw = ethers.parseUnits(amountStr, assetConfig.decimals);
              }

              // 🔥 OPTIMIZED: Use token metadata cache instead of direct query
              const tokenCache = (fastify as any).tokenMetadataCache;
              const tokenMetadata = await tokenCache.getTokenMetadata(normalizedToken);

              console.log(`📊 DEX Quote request for ${normalizedToken}`);
              console.log(`🏊 Pool address from cache: ${tokenMetadata?.poolAddress || 'null'}`);

              // Store the known pool address for routing
              const knownPoolAddress = tokenMetadata?.poolAddress ?? undefined;

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
                    throw new Error('Route pool not found');
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
                  routePath = [
                    normalizedToken,
                    assetMetadata.ETH.address,
                    assetMetadata.ACES.address,
                  ];
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
                    throw new Error('Route pool not found');
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
                  routePath = [
                    assetMetadata.ACES.address,
                    assetMetadata.ETH.address,
                    normalizedToken,
                  ];
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
                    throw new Error(
                      `Route pool not found: ${missingPool} pool is missing. ${!acesToToken ? 'Token may not be bonded yet.' : ''}`,
                    );
                  }

                  // Calculate WETH -> ACES swap
                  const acesAmountRaw = computeSwap(
                    amountInRaw,
                    wethToAces.reserveIn,
                    wethToAces.reserveOut,
                  );
                  console.log(
                    `  Intermediate ACES amount: ${ethers.formatUnits(acesAmountRaw, 18)}`,
                  );

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
                  routePath = [
                    assetMetadata.ETH.address,
                    assetMetadata.ACES.address,
                    normalizedToken,
                  ];
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

                const isUsdc = assetConfig!.symbol === 'USDC';
                let stableToWeth;
                let firstHopAmount = amountInRaw;
                const preWethHops: Array<{ from: string; to: string; stable: boolean }> = [];

                // For USDT, route through USDC first to avoid Slipstream V3 pool issues
                if (!isUsdc) {
                  console.log(`🔄 USDT detected - routing through USDC first`);
                  const usdcUsdtPool =
                    process.env.USDC_USDT_POOL || '0x5E7801e9B3aFf7C785E4E74Ff2076d4967d0cB6B';

                  console.log(`🔍 Step 1: USDT -> USDC`);
                  console.log(`  Pool: ${usdcUsdtPool}`);

                  const usdtToUsdc = await service.getPairReserves(
                    assetConfig!.address, // USDT
                    assetMetadata.USDC.address,
                    usdcUsdtPool.toLowerCase(),
                  );

                  if (!usdtToUsdc) {
                    console.error(`❌ USDT/USDC pool not found`);
                    return reply.code(404).send({
                      success: false,
                      error: `USDT/USDC pool not found. Expected pool: ${usdcUsdtPool}`,
                    });
                  }

                  console.log(`  ✅ USDT/USDC pool found: ${usdtToUsdc.poolAddress}`);
                  console.log(`  Reserve in (USDT): ${usdtToUsdc.reserveIn}`);
                  console.log(`  Reserve out (USDC): ${usdtToUsdc.reserveOut}`);

                  // Compute USDT -> USDC
                  firstHopAmount = computeSwap(
                    amountInRaw,
                    usdtToUsdc.reserveIn,
                    usdtToUsdc.reserveOut,
                  );

                  console.log(
                    `  💱 Converted ${ethers.formatUnits(amountInRaw, 6)} USDT -> ${ethers.formatUnits(firstHopAmount, 6)} USDC`,
                  );

                  intermediateSteps.push({
                    symbol: 'USDC',
                    amount: ethers.formatUnits(firstHopAmount, 6),
                  });

                  preWethHops.push({
                    from: assetConfig!.address,
                    to: assetMetadata.USDC.address,
                    stable: Boolean(usdtToUsdc.stable),
                  });
                }

                // Now USDC -> WETH (firstHopAmount is either original USDC or converted from USDT)
                const wethUsdcPool =
                  process.env.WETH_USDC_POOL || '0xcdac0d6c6c59727a65f871236188350531885c43';

                console.log(
                  `🔍 Step ${isUsdc ? '1' : '2'}: ${isUsdc ? 'USDC' : 'USDC (from USDT)'} -> WETH`,
                );
                console.log(`  Pool: ${wethUsdcPool}`);

                stableToWeth = await service.getPairReserves(
                  assetMetadata.USDC.address,
                  assetMetadata.ETH.address,
                  wethUsdcPool.toLowerCase(),
                );

                if (!stableToWeth) {
                  console.warn(
                    `⚠️ USDC/WETH pool lookup failed, retrying with reversed param order...`,
                  );
                  stableToWeth = await service.getPairReserves(
                    assetMetadata.ETH.address,
                    assetMetadata.USDC.address,
                    wethUsdcPool.toLowerCase(),
                  );
                }

                if (!stableToWeth) {
                  console.error(`❌ Failed to find USDC/WETH pool`);
                  return reply.code(404).send({
                    success: false,
                    error: `USDC/WETH pool not found. Expected pool: ${wethUsdcPool}`,
                  });
                }

                console.log(`  ✅ USDC/WETH pool found: ${stableToWeth.poolAddress}`);

                const wethAmountRaw = computeSwap(
                  firstHopAmount,
                  stableToWeth.reserveIn,
                  stableToWeth.reserveOut,
                );

                console.log(
                  `  💱 Converted ${ethers.formatUnits(firstHopAmount, 6)} USDC -> ${ethers.formatUnits(wethAmountRaw, 18)} WETH`,
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

                  // Build route path: USDT -> USDC -> WETH -> TOKEN (or USDC -> WETH -> TOKEN)
                  if (isUsdc) {
                    routePath = [assetConfig!.address, assetMetadata.ETH.address, normalizedToken];
                  } else {
                    routePath = [
                      assetConfig!.address,
                      assetMetadata.USDC.address,
                      assetMetadata.ETH.address,
                      normalizedToken,
                    ];
                  }

                  // Add all route hops
                  routes.push(...preWethHops); // USDT -> USDC if applicable
                  routes.push({
                    from: assetMetadata.USDC.address,
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

                  intermediateSteps.push({
                    symbol: 'ACES',
                    amount: ethers.formatUnits(acesAmountRaw, 18),
                  });

                  expectedOutputRaw = computeSwap(
                    acesAmountRaw,
                    acesToToken.reserveIn,
                    acesToToken.reserveOut,
                  );
                  outputDecimals = tokenDecimals;
                  outputSymbol = 'TOKEN';

                  // Build route path: USDT -> USDC -> WETH -> ACES -> TOKEN (or USDC -> WETH -> ACES -> TOKEN)
                  if (isUsdc) {
                    routePath = [
                      assetConfig!.address,
                      assetMetadata.ETH.address,
                      assetMetadata.ACES.address,
                      normalizedToken,
                    ];
                  } else {
                    routePath = [
                      assetConfig!.address,
                      assetMetadata.USDC.address,
                      assetMetadata.ETH.address,
                      assetMetadata.ACES.address,
                      normalizedToken,
                    ];
                  }

                  // Add all route hops
                  routes.push(...preWethHops); // USDT -> USDC if applicable
                  routes.push({
                    from: assetMetadata.USDC.address,
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

              // Calculate USD values using AcesUsdPriceService
              let inputUsdValue: string | undefined;
              let outputUsdValue: string | undefined;
              const prices: {
                aces?: number;
                weth?: number;
                usdc?: number;
                usdt?: number;
              } = {} as const;

              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const acesUsdPriceService = (fastify as any).acesUsdPriceService;
                console.log('💰 [USD Calculation] Starting USD value calculation...');
                console.log(`   Service available: ${!!acesUsdPriceService}`);

                if (acesUsdPriceService) {
                  const priceResult = await acesUsdPriceService.getAcesUsdPrice();
                  const acesUsdPrice = Number.parseFloat(priceResult.price);
                  prices.aces = acesUsdPrice;

                  console.log(`   ACES USD Price: $${acesUsdPrice}`);
                  console.log(`   Price source: ${priceResult.source}`);

                  // Stablecoins are $1
                  prices.usdc = 1.0;
                  prices.usdt = 1.0;

                  // Get WETH price from WETH/USDC pool
                  try {
                    const wethUsdcPool = await service.getPairReserves(
                      assetMetadata.ETH.address,
                      assetMetadata.USDC.address,
                      '0xcdac0d6c6c59727a65f871236188350531885c43',
                    );
                    if (wethUsdcPool) {
                      const wethReserve = Number(
                        ethers.formatUnits(wethUsdcPool.reserveIn, wethUsdcPool.decimalsIn),
                      );
                      const usdcReserve = Number(
                        ethers.formatUnits(wethUsdcPool.reserveOut, wethUsdcPool.decimalsOut),
                      );
                      prices.weth = wethReserve > 0 ? usdcReserve / wethReserve : 3000;
                    } else {
                      prices.weth = 3000; // Fallback
                    }
                  } catch (error) {
                    console.warn('Failed to get WETH price from pool:', error);
                    prices.weth = 3000; // Fallback
                  }

                  // Calculate input USD value
                  const inputAmount = Number.parseFloat(amountStr);
                  console.log(`💵 [USD Calculation] Input calculation:`);
                  console.log(`   Input amount: ${inputAmount}`);
                  console.log(`   Is sell mode: ${isSellMode}`);
                  console.log(`   Input asset: ${isSellMode ? 'TOKEN' : assetConfig!.symbol}`);

                  if (isSellMode) {
                    // Selling TOKEN - calculate based on output ACES value
                    const outputInAces = Number.parseFloat(
                      ethers.formatUnits(expectedOutputRaw, outputDecimals),
                    );
                    inputUsdValue = (outputInAces * acesUsdPrice).toFixed(2);
                    console.log(`   Calculated (TOKEN sell): $${inputUsdValue}`);
                  } else if (assetConfig!.symbol === 'ACES') {
                    inputUsdValue = (inputAmount * acesUsdPrice).toFixed(2);
                    console.log(
                      `   Calculated (ACES): ${inputAmount} × $${acesUsdPrice} = $${inputUsdValue}`,
                    );
                  } else if (assetConfig!.symbol === 'USDC' || assetConfig!.symbol === 'USDT') {
                    inputUsdValue = inputAmount.toFixed(2);
                    console.log(`   Calculated (${assetConfig!.symbol}): $${inputUsdValue}`);
                  } else if (assetConfig!.symbol === 'ETH') {
                    inputUsdValue = (inputAmount * prices.weth).toFixed(2);
                    console.log(
                      `   Calculated (ETH): ${inputAmount} × $${prices.weth} = $${inputUsdValue}`,
                    );
                  }

                  // Calculate output USD value
                  const outputAmount = Number.parseFloat(
                    ethers.formatUnits(expectedOutputRaw, outputDecimals),
                  );
                  console.log(`💵 [USD Calculation] Output calculation:`);
                  console.log(`   Output amount: ${outputAmount}`);
                  console.log(`   Output symbol: ${outputSymbol}`);

                  if (outputSymbol === 'ACES') {
                    outputUsdValue = (outputAmount * acesUsdPrice).toFixed(2);
                    console.log(
                      `   Calculated (ACES): ${outputAmount} × $${acesUsdPrice} = $${outputUsdValue}`,
                    );
                  } else if (outputSymbol === 'TOKEN') {
                    // TOKEN output - use input USD value as approximation
                    outputUsdValue = inputUsdValue;
                    console.log(`   Calculated (TOKEN): using input value = $${outputUsdValue}`);
                  }

                  console.log(`✅ [USD Calculation] Final values:`);
                  console.log(`   Input USD: $${inputUsdValue || 'undefined'}`);
                  console.log(`   Output USD: $${outputUsdValue || 'undefined'}`);
                }
              } catch (error) {
                console.error('❌ [USD Calculation] Failed to calculate USD values:', error);
                // Continue without USD values
              }

              // Fallback path: if we still don't have valid USD values (e.g., service unavailable or price=0),
              // compute ACES/USD from on-chain reserves and fill at least input USD
              const inputAmtNum = Number.parseFloat(amountStr);
              const inputUsdNum = inputUsdValue ? Number.parseFloat(String(inputUsdValue)) : NaN;
              const needsUsdFallback =
                (!inputUsdValue ||
                  (!Number.isNaN(inputUsdNum) && inputUsdNum === 0 && inputAmtNum > 0)) &&
                (!prices.aces || prices.aces <= 0);

              if (needsUsdFallback) {
                try {
                  console.log(
                    '🛟 [USD Fallback] Attempting fallback ACES/USD computation from pools...',
                  );

                  // 1) Get WETH/USD price from WETH/USDC pool
                  let wethUsd: number | null = null;
                  try {
                    const wethUsdcPool = await service.getPairReserves(
                      assetMetadata.ETH.address,
                      assetMetadata.USDC.address,
                      '0xcdac0d6c6c59727a65f871236188350531885c43',
                    );
                    if (wethUsdcPool) {
                      const wethReserve = Number(
                        ethers.formatUnits(wethUsdcPool.reserveIn, wethUsdcPool.decimalsIn),
                      );
                      const usdcReserve = Number(
                        ethers.formatUnits(wethUsdcPool.reserveOut, wethUsdcPool.decimalsOut),
                      );
                      wethUsd = wethReserve > 0 ? usdcReserve / wethReserve : null;
                      prices.weth = wethUsd ?? prices.weth;
                    }
                  } catch (err) {
                    console.warn('🛟 [USD Fallback] Failed to load WETH/USD from pool:', err);
                  }

                  // 2) Get ACES per WETH from ACES/WETH pool
                  let acesPerWeth: number | null = null;
                  try {
                    const envAcesWeth = process.env.AERODROME_ACES_WETH_POOL || '';
                    const knownAcesWeth = envAcesWeth ? envAcesWeth.toLowerCase() : undefined;
                    const acesWethPool = await service.getPairReserves(
                      assetMetadata.ACES.address,
                      assetMetadata.ETH.address,
                      knownAcesWeth,
                    );
                    if (acesWethPool) {
                      const acesReserve = Number(
                        ethers.formatUnits(acesWethPool.reserveIn, acesWethPool.decimalsIn),
                      );
                      const wethReserve = Number(
                        ethers.formatUnits(acesWethPool.reserveOut, acesWethPool.decimalsOut),
                      );
                      if (acesReserve > 0 && wethReserve > 0) {
                        acesPerWeth = acesReserve / wethReserve; // ACES per 1 WETH
                      }
                    }
                  } catch (err) {
                    console.warn('🛟 [USD Fallback] Failed to load ACES/WETH reserves:', err);
                  }

                  // 3) Derive ACES/USD and compute input/output USD
                  if (!prices.aces && wethUsd && acesPerWeth && acesPerWeth > 0) {
                    const acesUsdDerived = wethUsd / acesPerWeth;
                    prices.aces = acesUsdDerived;
                    console.log(
                      `🛟 [USD Fallback] Derived ACES/USD: $${acesUsdDerived.toFixed(6)}`,
                    );

                    const inputAmount = inputAmtNum;
                    if (isSellMode) {
                      const outputInAces = Number.parseFloat(
                        ethers.formatUnits(expectedOutputRaw, outputDecimals),
                      );
                      inputUsdValue = (outputInAces * acesUsdDerived).toFixed(2);
                    } else if (assetConfig!.symbol === 'ACES') {
                      inputUsdValue = (inputAmount * acesUsdDerived).toFixed(2);
                    } else if (assetConfig!.symbol === 'ETH' && wethUsd) {
                      inputUsdValue = (inputAmount * wethUsd).toFixed(2);
                    } else if (assetConfig!.symbol === 'USDC' || assetConfig!.symbol === 'USDT') {
                      inputUsdValue = inputAmount.toFixed(2);
                    }

                    if (!outputUsdValue) {
                      const outputAmount = Number.parseFloat(
                        ethers.formatUnits(expectedOutputRaw, outputDecimals),
                      );
                      if (outputSymbol === 'ACES') {
                        outputUsdValue = (outputAmount * acesUsdDerived).toFixed(2);
                      } else if (outputSymbol === 'TOKEN') {
                        outputUsdValue = inputUsdValue;
                      }
                    }
                  }
                } catch (fallbackErr) {
                  console.warn('🛟 [USD Fallback] Fallback USD computation failed:', fallbackErr);
                }
              }

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
                inputUsdValue,
                outputUsdValue,
                prices,
              };

              return quote;
            },
            CACHE_TTL, // 🔥 PHASE 4: 3 seconds TTL (quotes change frequently)
          );

          // Store promise in map
          quoteRequestMap.set(cacheKey, quotePromise);

          // Clean up map when done
          quotePromise.finally(() => {
            quoteRequestMap.delete(cacheKey);
          });
        }

        const quote = await quotePromise;

        // Check if this was a cache hit by comparing stats
        const statsAfter = fastify.cache?.getStats() || { hits: 0, misses: 0 };
        const wasCached = isCoalesced || statsAfter.hits > statsBefore.hits;

        fastify.log.info(
          {
            tokenAddress: normalizedToken,
            inputAsset: inputAssetCode,
            amount: amountStr,
            cached: wasCached,
            coalesced: isCoalesced,
          },
          wasCached ? '✅ [DEX Quote] Cache/Coalesce hit' : '✅ [DEX Quote] Successfully computed',
        );

        return reply.send({
          success: true,
          data: quote,
          cached: wasCached,
          coalesced: isCoalesced,
        });
      } catch (error) {
        console.error('❌ ERROR in DEX quote handler:', error);
        fastify.log.error({ err: error }, 'Failed to compute quote');

        // Handle errors from cache callback (400/404 errors)
        const errorMessage = error instanceof Error ? error.message : 'Dex service unavailable';
        const statusCode =
          errorMessage.includes('Unsupported input asset') ||
          errorMessage.includes('Invalid amount')
            ? 400
            : errorMessage.includes('Route pool not found') ||
                errorMessage.includes('Pool not found')
              ? 404
              : 503;

        return reply.code(statusCode).send({
          success: false,
          error: errorMessage,
        });
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
      const { address } = request.params;
      const { resolution = '5m', lookbackMinutes = 60 } = request.query;

      try {
        // 🔥 LOAD TEST FIX: Check in-memory cache first
        const cacheKey = `${address.toLowerCase()}:${resolution}:${lookbackMinutes}`;
        const cached = candleCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CANDLE_CACHE_TTL_MS) {
          return reply.send({
            success: true,
            data: cached.data,
            source: 'cache',
          });
        }

        // 🔥 LOAD TEST FIX: Request Coalescing (Join in-flight requests)
        if (candleRequestMap.has(cacheKey)) {
          const coalescedData = await candleRequestMap.get(cacheKey);
          return reply.send({
            success: true,
            data: coalescedData,
            source: 'coalesced',
          });
        }

        // Create the fetch promise
        const fetchPromise = (async () => {
          const service = ensureService();

          // 🔥 LOAD TEST FIX: Racing Pattern
          // Race Aerodrome (RPC) vs BitQuery (API) - First successful response wins
          // This drastically reduces tail latency (p95) because if RPC stalls, BitQuery saves us.

          const fetchAerodrome = async () => {
            return service
              .getCandles(address, resolution as '5m' | '15m' | '1h' | '4h' | '1d', lookbackMinutes)
              .then((candles) => ({ candles, source: 'aerodrome' }));
          };

          const fetchBitQuery = async () => {
            const bitQueryService = new BitQueryService((fastify as any).acesUsdPriceService);
            const now = new Date();
            const from = new Date(now.getTime() - lookbackMinutes * 60 * 1000);
            return bitQueryService
              .getOHLCCandles(address, '', resolution, { from, to: now })
              .then((candles) => ({ candles, source: 'bitquery' }));
          };

          try {
            // Promise.any resolves as soon as the FIRST promise fulfills
            // It only rejects if ALL promises reject
            const result = await Promise.any([fetchAerodrome(), fetchBitQuery()]);

            const responseData = {
              resolution,
              candles: result.candles,
            };

            // Cache the successful result
            candleCache.set(cacheKey, {
              data: responseData,
              timestamp: Date.now(),
            });

            return responseData;
          } catch (aggregateError) {
            fastify.log.error(
              { err: aggregateError, tokenAddress: address },
              'Both Aerodrome and BitQuery candles failed',
            );
            throw new Error('Dex service unavailable - all data sources failed');
          } finally {
            // Cleanup coalescing map
            candleRequestMap.delete(cacheKey);
          }
        })();

        // Store promise in map for coalescing
        candleRequestMap.set(cacheKey, fetchPromise);

        const data = await fetchPromise;
        return reply.send({
          success: true,
          data: {
            resolution: data.resolution,
            candles: data.candles,
          },
        });
      } catch (error: any) {
        // Clean error handling
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const statusCode = errorMessage.includes('unavailable') ? 503 : 500;

        return reply.code(statusCode).send({
          success: false,
          error: errorMessage,
        });
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
              .default('80'), // Changed default to 80
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
        const { limit = 80 } = request.query; // Changed default to 80

        // 🔥 QUICK WIN #2: Cache + Request Coalescing
        const cacheKey = `${address.toLowerCase()}:${limit}`;
        const now = Date.now();

        // Check cache first
        const cached = dexTradesCache.get(cacheKey);
        if (cached && now - cached.timestamp < DEX_TRADES_CACHE_TTL_MS) {
          fastify.log.info(
            { address, limit, age: now - cached.timestamp },
            '🎯 DEX Trades cache hit',
          );
          return reply.send(cached.data);
        }

        // Check if request is already pending (coalescing)
        const pending = dexTradesPendingRequests.get(cacheKey);
        if (pending) {
          fastify.log.info({ address, limit }, '🤝 Joining pending DEX trades request');
          const result = await pending;
          return reply.send(result);
        }

        // Start new request
        const promise = (async () => {
          try {
            // 🔥 CRITICAL: Fetch ACES/USD price for accurate USD conversions
            const acesUsdPriceService = (fastify as any).acesUsdPriceService;
            let acesUsdPrice: number | null = null;

            if (acesUsdPriceService) {
              try {
                const priceResult = await acesUsdPriceService.getAcesUsdPrice();
                acesUsdPrice = Number.parseFloat(priceResult.price);
                fastify.log.info(
                  { acesUsdPrice, source: priceResult.source },
                  '💰 ACES/USD price loaded for trades',
                );
              } catch (err) {
                fastify.log.warn({ err }, '⚠️ Failed to fetch ACES/USD price for trades');
              }
            }

            // 🔥 OPTIMIZED: Use token metadata cache instead of direct query
            const tokenCache = (fastify as any).tokenMetadataCache;
            const tokenMetadata = await tokenCache.getTokenMetadata(address);

            // Determine if token is graduated
            const isGraduated = tokenMetadata?.poolAddress && tokenMetadata.phase === 'DEX_TRADING';
            const dexLiveAt = tokenMetadata?.dexLiveAt;

            // Fetch trades from both sources
            const allTrades: Array<{
              txHash: string;
              timestamp: number;
              blockNumber: string;
              direction: 'buy' | 'sell';
              amountToken: string;
              amountCounter: string;
              priceInCounter: number;
              priceInUsd?: number;
              totalUsd?: number;
              trader?: string;
              source: 'bonding' | 'dex';
            }> = [];

            // 1. Fetch DEX trades from BitQuery (if graduated)
            if (isGraduated) {
              try {
                const bitquery = new BitQueryService((fastify as any).acesUsdPriceService);
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const dexTrades = await bitquery.getTokenTrades(address, limit, {
                  from: thirtyDaysAgo,
                  to: new Date(),
                });

                const transformedDexTrades = dexTrades.map((trade) => {
                  const priceInCounter = parseFloat(trade.priceInAces);
                  const amountCounter = parseFloat(trade.amountAces);

                  // 🔥 FIX: Don't trust BitQuery's priceInUsd - it's actually ACES price, not USD
                  // Recalculate ourselves using real ACES/USD conversion
                  const priceInUsd =
                    acesUsdPrice && priceInCounter ? priceInCounter * acesUsdPrice : undefined;

                  const totalUsd =
                    acesUsdPrice && amountCounter ? amountCounter * acesUsdPrice : undefined;

                  return {
                    txHash: trade.txHash,
                    timestamp: new Date(trade.blockTime).getTime(),
                    blockNumber: trade.blockNumber.toString(),
                    direction: trade.side as 'buy' | 'sell',
                    amountToken: trade.amountToken,
                    amountCounter: trade.amountAces,
                    priceInCounter,
                    priceInUsd, // ← Now correctly calculated
                    totalUsd, // ← New field for total trade value in USD
                    trader: trade.sender,
                    source: 'dex' as const,
                  };
                });

                allTrades.push(...transformedDexTrades);
                console.log(
                  `[DEX Trades] ✅ Fetched ${transformedDexTrades.length} DEX trades from BitQuery`,
                );
              } catch (err: any) {
                console.warn('[DEX Trades] BitQuery fetch failed:', err);
              }
            }

            // 2. Fetch bonding curve trades from Goldsky (if not graduated OR if we need more trades)
            const remainingSlots = limit - allTrades.length;
            if (remainingSlots > 0) {
              try {
                const goldskyClient = (fastify as any).goldskyClient;
                if (goldskyClient) {
                  // If graduated, only fetch trades before graduation
                  const toTimestamp = dexLiveAt
                    ? Math.floor(dexLiveAt.getTime() / 1000)
                    : Math.floor(Date.now() / 1000);
                  const fromTimestamp = toTimestamp - 30 * 24 * 60 * 60; // 30 days ago

                  const bondingTrades = await goldskyClient.getTrades(
                    address,
                    remainingSlots,
                    fromTimestamp,
                    toTimestamp,
                    fastify.log,
                  );

                  const transformedBondingTrades = bondingTrades.map((trade: SubgraphTrade) => ({
                    txHash: trade.id,
                    timestamp: parseInt(trade.createdAt) * 1000, // Parse string timestamp to number
                    blockNumber: trade.blockNumber?.toString() || '0',
                    direction: trade.isBuy ? ('buy' as const) : ('sell' as const),
                    amountToken: trade.tokenAmount || '0',
                    amountCounter: trade.acesTokenAmount || '0',
                    priceInCounter: 0, // Will be calculated from amounts
                    priceInUsd: undefined, // Bonding curve trades don't have USD prices
                    trader: trade.trader?.address,
                    source: 'bonding' as const,
                  }));

                  allTrades.push(...transformedBondingTrades);
                  console.log(
                    `[DEX Trades] ✅ Fetched ${transformedBondingTrades.length} bonding trades from Goldsky`,
                  );
                }
              } catch (err: any) {
                console.warn('[DEX Trades] Goldsky fetch failed:', err);
              }
            }

            // 3. Sort all trades by timestamp (newest first) and limit to requested amount
            allTrades.sort((a, b) => b.timestamp - a.timestamp);
            const finalTrades = allTrades.slice(0, limit);

            console.log(
              `[DEX Trades] ✅ Combined ${finalTrades.length} trades (${finalTrades.filter((t) => t.source === 'dex').length} DEX + ${finalTrades.filter((t) => t.source === 'bonding').length} bonding)`,
            );

            // Include graduation metadata (using cached data)
            const graduationMeta = {
              isDexLive: isGraduated,
              poolAddress: tokenMetadata?.poolAddress || null,
              dexLiveAt: dexLiveAt?.toISOString() || null,
              bondingCutoff: dexLiveAt?.toISOString() || null,
            };

            const response = {
              success: true,
              data: finalTrades,
              meta: {
                graduation: graduationMeta,
              },
            };

            // Cache the response
            dexTradesCache.set(cacheKey, { data: response, timestamp: Date.now() });
            return response;
          } finally {
            // Clean up pending request
            dexTradesPendingRequests.delete(cacheKey);
          }
        })();

        // Store pending request for coalescing
        dexTradesPendingRequests.set(cacheKey, promise);

        // Wait for result
        const result = await promise;
        return reply.send(result);
      } catch (error) {
        console.error('[DEX Trades] ❌ ERROR in trades endpoint:', error);
        console.error(
          '[DEX Trades] Error type:',
          error instanceof Error ? error.constructor.name : typeof error,
        );
        console.error(
          '[DEX Trades] Error message:',
          error instanceof Error ? error.message : String(error),
        );
        console.error('[DEX Trades] Error stack:', error instanceof Error ? error.stack : 'N/A');
        fastify.log.error({ err: error }, 'Failed to fetch trades');
        return reply.code(503).send({ success: false, error: 'Dex service unavailable' });
      }
    },
  );
}
