import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ethers } from 'ethers';
import { getNetworkConfig, createProvider } from '../../config/network.config';
import { AerodromeDataService } from '../../services/aerodrome-data-service';
import { priceCacheService } from '../../services/price-cache-service';
import { bondingQuoteCache, multiHopQuoteCache } from '../../lib/quote-cache';
import { getOptimizedQuote } from '../../lib/bonding-curve-math';

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

interface MultiHopQuoteParams {
  tokenAddress: string;
}

interface MultiHopQuoteQuery {
  inputAsset?: string;
  amount?: string;
  slippageBps?: string;
}

interface DirectQuoteParams {
  tokenAddress: string;
}

interface DirectQuoteQuery {
  inputAsset?: string;
  amount?: string;
  slippageBps?: string;
}

interface DirectQuoteResponse {
  inputAsset: 'ACES' | 'TOKEN';
  inputAmount: string;
  expectedOutput: string;
  inputUsdValue: string | null;
  outputUsdValue: string | null;
  path: string[];
  slippageBps: number;
}

interface MultiHopQuoteResponse {
  inputAsset: 'ACES' | 'WETH' | 'ETH' | 'USDC' | 'USDT';
  inputAmount: string;
  inputAmountRaw?: string;
  expectedAcesAmount: string;
  expectedAcesAmountRaw?: string;
  minAcesAmount?: string;
  minAcesAmountRaw?: string;
  expectedRwaOutput: string;
  path: string[];
  intermediate?: Array<{ symbol: string; amount: string }>;
  slippageBps: number;
  needsMultiHop: boolean;
  inputUsdValue?: string | null;
  outputUsdValue?: string | null;
}

// Factory contract ABI for bonding curve calculations
const FACTORY_ABI = [
  'function getBuyPriceAfterFee(address token, uint256 amount) view returns (uint256)',
  'function getSellPriceAfterFee(address token, uint256 amount) view returns (uint256)',
  'function tokens(address) view returns (uint8 curve, address tokenAddress, uint256 floor, uint256 steepness, uint256 acesTokenBalance, address subjectFeeDestination, uint256 tokensBondedAt, bool tokenBonded)',
];

const TOKEN_ABI = ['function decimals() view returns (uint8)'];

/**
 * Bonding curve quote routes
 * Handles both direct ACES ↔ TOKEN quotes and multi-hop quotes
 */
export async function bondingRoutes(fastify: FastifyInstance) {
  // Cache for token info (steepness, floor) - these are immutable per token
  // Key: tokenAddress
  const tokenInfoCache = new Map<
    string,
    {
      steepness: bigint;
      floor: bigint;
      tokenBonded: boolean;
      timestamp: number;
    }
  >();
  const TOKEN_INFO_TTL = 60 * 60 * 1000; // 1 hour

  // Cache for pool reserves
  // Key: poolAddress
  const poolReservesCache = new Map<
    string,
    {
      reserveIn: bigint;
      reserveOut: bigint;
      decimalsIn: number;
      decimalsOut: number;
      timestamp: number;
    }
  >();
  const POOL_RESERVES_TTL = 3000; // 3 seconds

  // Request coalescing for pool reserves
  const poolReservesPending = new Map<string, Promise<any>>();

  /**
   * Direct bonding curve quote endpoint
   * GET /api/v1/bonding/:tokenAddress/quote
   *
   * Returns quotes for ACES → TOKEN (buy) or TOKEN → ACES (sell)
   * Uses factory contract's getBuyPriceAfterFee and getSellPriceAfterFee methods
   */
  fastify.get(
    '/:tokenAddress/quote',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            tokenAddress: addressSchema,
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            inputAsset: z.enum(['ACES', 'TOKEN']).default('ACES'),
            amount: z.string(),
            slippageBps: z.string().optional(),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: DirectQuoteParams;
        Querystring: DirectQuoteQuery;
      }>,
      reply,
    ) => {
      try {
        const { tokenAddress } = request.params;
        const { inputAsset = 'ACES', amount, slippageBps = '100' } = request.query;

        fastify.log.info(
          { tokenAddress, inputAsset, amount, slippageBps },
          '🔵 [DirectBondingQuote] Request received',
        );

        // Validate inputs
        if (!amount) {
          return reply.code(400).send({
            success: false,
            error: 'Amount is required',
          });
        }

        const amountNum = parseFloat(amount);
        if (!isFinite(amountNum) || amountNum <= 0) {
          fastify.log.warn({ amount }, '❌ [DirectBondingQuote] Invalid amount');
          return reply.code(400).send({
            success: false,
            error: 'Invalid amount',
          });
        }

        const slippage = parseInt(slippageBps || '100');

        // Check cache first
        const cacheKey = { tokenAddress, inputAsset, amount, slippageBps: slippage };
        const cachedQuote = bondingQuoteCache.get(cacheKey);

        if (cachedQuote) {
          fastify.log.info(
            { tokenAddress, inputAsset, amount },
            '💰 [DirectBondingQuote] Cache hit',
          );
          return reply.send({
            success: true,
            data: cachedQuote,
          });
        }

        // Setup network and provider
        const networkConfig = getNetworkConfig(8453);
        const acesAddress = networkConfig.acesToken;
        const factoryProxyAddress = networkConfig.acesFactoryProxy;
        const provider = createProvider(8453);

        console.log('🏭 Factory configuration:', {
          factoryProxyAddress,
          acesAddress,
          hasProvider: !!provider,
        });

        if (!provider) {
          fastify.log.error('❌ [DirectBondingQuote] RPC provider not available');
          return reply.code(500).send({
            success: false,
            error: 'RPC provider not available',
          });
        }

        if (!factoryProxyAddress) {
          fastify.log.error('❌ [DirectBondingQuote] Factory proxy not configured');
          return reply.code(500).send({
            success: false,
            error: 'Factory proxy not configured',
          });
        }

        // Initialize contracts
        const factoryContract = new ethers.Contract(factoryProxyAddress, FACTORY_ABI, provider);
        const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);

        // Get token decimals
        const tokenDecimals = Number(await tokenContract.decimals());

        fastify.log.info(
          { tokenAddress, tokenDecimals },
          '✅ [DirectBondingQuote] Token info fetched',
        );

        let expectedOutput: string = '0';
        let outputAsset: string = tokenAddress;

        // Try to get token info from subgraph first (more reliable for older tokens)
        // If that fails, fall back to direct contract query
        let tokenInfo;
        let tokenParams: { steepness: bigint; floor: bigint } | null = null;

        try {
          const subgraphUrl = process.env.GOLDSKY_SUBGRAPH_URL;
          console.log(
            '🔍 Attempting to fetch from subgraph:',
            subgraphUrl ? 'URL configured' : 'NO URL',
          );

          if (subgraphUrl) {
            const subgraphQuery = `{
              tokens(where: { address: "${tokenAddress.toLowerCase()}" }) {
                address
                curve
                steepness
                floor
              }
            }`;

            console.log('📤 Subgraph query:', subgraphQuery);

            const subgraphResponse = await fetch(subgraphUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: subgraphQuery }),
            });

            console.log('📥 Subgraph response status:', subgraphResponse.status);

            if (subgraphResponse.ok) {
              const subgraphData = (await subgraphResponse.json()) as {
                data?: {
                  tokens?: Array<{
                    address: string;
                    curve: number;
                    steepness: string;
                    floor: string;
                  }>;
                };
              };

              console.log('📦 Subgraph data:', JSON.stringify(subgraphData, null, 2));
              const tokens = subgraphData?.data?.tokens;

              if (tokens && tokens.length > 0) {
                const token = tokens[0];
                console.log('✅ Got token params from subgraph:', {
                  address: token.address,
                  steepness: token.steepness,
                  floor: token.floor,
                });

                // Store params for later use
                tokenParams = {
                  steepness: BigInt(token.steepness),
                  floor: BigInt(token.floor),
                };

                // Verify token data from contract as a sanity check
                try {
                  const contractTokenInfo = await factoryContract.tokens(tokenAddress);
                  console.log('🔍 Verifying token info from contract:', {
                    curve: contractTokenInfo.curve,
                    tokenAddress: contractTokenInfo.tokenAddress,
                    floor: contractTokenInfo.floor.toString(),
                    steepness: contractTokenInfo.steepness.toString(),
                    acesTokenBalance: contractTokenInfo.acesTokenBalance.toString(),
                    tokenBonded: contractTokenInfo.tokenBonded,
                  });

                  // If contract returns valid data (non-zero tokenAddress), use it as authoritative
                  if (
                    contractTokenInfo.tokenAddress !== '0x0000000000000000000000000000000000000000'
                  ) {
                    console.log('✅ Contract has valid token data, using contract data');
                    tokenInfo = contractTokenInfo; // SET tokenInfo so later checks work!
                    tokenParams = {
                      steepness: contractTokenInfo.steepness,
                      floor: contractTokenInfo.floor,
                    };

                    // Check if token is bonded
                    if (contractTokenInfo.tokenBonded) {
                      return reply.code(400).send({
                        success: false,
                        error: 'Token is fully bonded, use DEX mode',
                      });
                    }
                  } else {
                    console.log('⚠️ Contract returned zero address, using subgraph data');
                  }
                } catch (contractError) {
                  console.warn(
                    '⚠️ Could not verify from contract, using subgraph data:',
                    contractError,
                  );
                }
              } else {
                console.log('⚠️ No tokens found in subgraph response');
              }
            } else {
              console.log('❌ Subgraph response not OK');
            }
          }
        } catch (subgraphError) {
          console.error('❌ Subgraph error:', subgraphError);
          fastify.log.warn(
            { err: subgraphError },
            '⚠️ Failed to fetch from subgraph, will try contract',
          );
        }

        // Fall back to contract query if subgraph didn't work
        if (!tokenParams) {
          tokenInfo = await factoryContract.tokens(tokenAddress);

          console.log('🔍 Token info from contract:', {
            curve: tokenInfo.curve,
            tokenAddress: tokenInfo.tokenAddress,
            floor: tokenInfo.floor.toString(),
            steepness: tokenInfo.steepness.toString(),
            acesTokenBalance: tokenInfo.acesTokenBalance.toString(),
            tokenBonded: tokenInfo.tokenBonded,
          });

          tokenParams = {
            steepness: tokenInfo.steepness,
            floor: tokenInfo.floor,
          };

          if (tokenInfo.tokenBonded) {
            return reply.code(400).send({
              success: false,
              error: 'Token is fully bonded, use DEX mode',
            });
          }

          // Check if token exists (tokenAddress should not be zero address)
          if (tokenInfo.tokenAddress === '0x0000000000000000000000000000000000000000') {
            fastify.log.error({ tokenAddress }, '❌ Token not found in factory');
            return reply.code(404).send({
              success: false,
              error: 'Token not found or not registered with bonding curve',
            });
          }
        }

        // Validate bonding curve parameters
        if (!tokenParams) {
          fastify.log.error(
            { tokenAddress },
            '❌ No token params available from subgraph or contract',
          );
          return reply.code(404).send({
            success: false,
            error: 'Token not found or not registered with bonding curve',
          });
        }

        if (tokenParams.steepness === 0n) {
          fastify.log.error(
            { tokenAddress },
            '❌ Token has zero steepness - invalid bonding curve',
          );
          return reply.code(400).send({
            success: false,
            error: 'Invalid token: bonding curve has zero steepness',
          });
        }

        if (tokenParams.floor === 0n) {
          fastify.log.warn({ tokenAddress }, '⚠️ Token has zero floor price');
        }

        // Check if we should use contract methods or calculate directly
        // If contract returned zero address, we can't use its methods
        const canUseContractMethods =
          tokenInfo && tokenInfo.tokenAddress !== '0x0000000000000000000000000000000000000000';

        console.log('🎯 Quote calculation strategy:', {
          canUseContractMethods,
          willUseContractMethods: canUseContractMethods,
          willCalculateDirectly: !canUseContractMethods,
        });

        if (!canUseContractMethods) {
          console.log(
            '❌ Cannot use contract methods - token not found on configured factory contract',
          );
          console.log(
            '   Token has valid data in subgraph but not on contract:',
            factoryProxyAddress,
          );
          console.log('   This token may be on a different factory version');

          return reply.code(400).send({
            success: false,
            error:
              'This token is on a different factory version. Direct quotes are not available. Please use DEX mode or wait for backend update.',
          });
        }

        if (inputAsset === 'ACES') {
          // ACES → TOKEN (buy)
          // Use optimized math-based calculation (NO binary search, NO RPC spam!)
          const acesInputWei = ethers.parseUnits(amount, 18); // ACES is 18 decimals

          // Apply slippage to input ACES (reduce input to ensure success even if price moves)
          const acesInputWithSlippage = (acesInputWei * BigInt(10000 - slippage)) / BigInt(10000);

          fastify.log.info(
            {
              acesInputWei: acesInputWei.toString(),
              acesInputWithSlippage: acesInputWithSlippage.toString(),
              amount,
              slippage,
            },
            '🔄 [DirectBondingQuote] Calculating ACES → TOKEN via optimized math (no RPC spam)',
          );

          // Use optimized math-based calculation instead of binary search
          // This reduces RPC calls from 50+ to just 1-2!
          try {
            const quoteResult = await getOptimizedQuote({
              tokenAddress,
              inputAsset: 'ACES',
              amount: ethers.formatEther(acesInputWithSlippage),
              tokenDecimals,
              steepness: tokenParams.steepness,
              floor: tokenParams.floor,
              provider,
            });

            expectedOutput = quoteResult.expectedOutput;
            outputAsset = tokenAddress;

            console.log('✅ OPTIMIZED QUOTE (Math-based, no RPC spam):');
            console.log('  Token amount:', expectedOutput);
            console.log('  ACES input:', amount);
            console.log('  Supply used:', quoteResult.supplyUsed.toString());

            fastify.log.info(
              {
                tokenAmount: expectedOutput,
                acesInput: amount,
                supplyUsed: quoteResult.supplyUsed.toString(),
              },
              '✅ [DirectBondingQuote] Optimized quote calculated (1-2 RPC vs 50+)',
            );
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('❌ Error calculating optimized quote:', errorMsg);
            fastify.log.error({ err: error }, '❌ Failed to calculate optimized quote');

            if (errorMsg.includes('DIVIDE_BY_ZERO') || errorMsg.includes('Panic')) {
              return reply.code(400).send({
                success: false,
                error: 'This token has an invalid bonding curve configuration',
              });
            }

            throw error;
          }
        } else {
          // TOKEN → ACES (sell) - also use optimized math!
          fastify.log.info(
            { amount, tokenDecimals },
            '🔄 [DirectBondingQuote] Calculating TOKEN → ACES via optimized math',
          );

          try {
            const quoteResult = await getOptimizedQuote({
              tokenAddress,
              inputAsset: 'TOKEN',
              amount,
              tokenDecimals,
              steepness: tokenParams.steepness,
              floor: tokenParams.floor,
              provider,
            });

            expectedOutput = quoteResult.expectedOutput;
            outputAsset = acesAddress;

            console.log('✅ OPTIMIZED SELL QUOTE (Math-based):');
            console.log('  ACES received:', expectedOutput);
            console.log('  Tokens sold:', amount);

            fastify.log.info(
              { input: `${amount} TOKEN`, output: `${expectedOutput} ACES` },
              '✅ [DirectBondingQuote] TOKEN → ACES calculated (optimized)',
            );
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('❌ Error calculating optimized sell quote:', errorMsg);
            fastify.log.error({ err: error }, '❌ Failed to calculate TOKEN → ACES');

            if (errorMsg.includes('DIVIDE_BY_ZERO') || errorMsg.includes('Panic')) {
              return reply.code(400).send({
                success: false,
                error: 'This token has an invalid bonding curve configuration',
              });
            }

            if (errorMsg.includes('execution reverted')) {
              return reply.code(400).send({
                success: false,
                error: 'Unable to calculate quote. The token may be in an invalid state.',
              });
            }

            throw error;
          }
        }

        // Get ACES USD price for USD value calculation
        let inputUsdValue: string | null = null;
        let outputUsdValue: string | null = null;

        try {
          // Use price cache service directly instead of making HTTP call to self
          const priceData = await priceCacheService.getPrices();
          const acesUsd = priceData.acesUsd;

          if (acesUsd > 0) {
            if (inputAsset === 'ACES') {
              inputUsdValue = (amountNum * acesUsd).toFixed(2);
              outputUsdValue = inputUsdValue; // Approximate
            } else {
              const outputNum = parseFloat(expectedOutput);
              outputUsdValue = (outputNum * acesUsd).toFixed(2);
              inputUsdValue = outputUsdValue; // Approximate
            }
          }
        } catch (error) {
          fastify.log.warn({ error }, '⚠️ [DirectBondingQuote] Failed to fetch ACES USD price');
        }

        const response: DirectQuoteResponse = {
          inputAsset: inputAsset as 'ACES' | 'TOKEN',
          inputAmount: amount,
          expectedOutput,
          inputUsdValue,
          outputUsdValue,
          path: inputAsset === 'ACES' ? [acesAddress, tokenAddress] : [tokenAddress, acesAddress],
          slippageBps: slippage,
        };

        fastify.log.info(
          {
            inputAsset: response.inputAsset,
            inputAmount: response.inputAmount,
            expectedOutput: response.expectedOutput,
            inputUsdValue: response.inputUsdValue,
            outputUsdValue: response.outputUsdValue,
          },
          '✅ [DirectBondingQuote] Final response',
        );

        // Store in cache for future requests
        bondingQuoteCache.set(cacheKey, response);

        fastify.log.info(
          { tokenAddress, inputAsset, amount },
          '✅ [DirectBondingQuote] Quote computed and cached',
        );

        return reply.send({
          success: true,
          data: response,
        });
      } catch (error) {
        console.log('='.repeat(80));
        console.log('❌❌❌ DIRECT BONDING QUOTE ERROR ❌❌❌');
        console.log('Error:', error);
        console.log('Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.log('Stack:', error instanceof Error ? error.stack : 'No stack');
        console.log('='.repeat(80));

        fastify.log.error(
          { err: error },
          '❌ [DirectBondingQuote] Failed to compute direct bonding quote',
        );
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to calculate quote',
        });
      }
    },
  );

  fastify.get(
    '/:tokenAddress/multi-hop-quote',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            tokenAddress: addressSchema,
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            inputAsset: z.enum(['ACES', 'WETH', 'ETH', 'USDC', 'USDT']).default('ACES'),
            amount: z.string(),
            slippageBps: z.string().optional(),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: MultiHopQuoteParams;
        Querystring: MultiHopQuoteQuery;
      }>,
      reply,
    ) => {
      try {
        const { tokenAddress } = request.params;
        // 🔥 LOAD TEST FIX: Normalize ETH -> WETH immediately
        // Bonding curve interacts with WETH, so map ETH to WETH
        let { inputAsset = 'ACES' } = request.query;
        if (inputAsset === 'ETH') {
          inputAsset = 'WETH';
        }

        const { amount, slippageBps = '100' } = request.query;

        fastify.log.info(
          { tokenAddress, inputAsset, amount, slippageBps },
          '🔵 [BondingQuote] Request received',
        );

        // Validate inputs
        const amountNum = parseFloat(amount || '0');
        if (!isFinite(amountNum) || amountNum <= 0) {
          fastify.log.warn({ amount }, '❌ [BondingQuote] Invalid amount');
          return reply.code(400).send({
            success: false,
            error: 'Invalid amount',
          });
        }

        const slippage = parseInt(slippageBps);

        // Check cache first (before ACES check)
        const cacheKey = { tokenAddress, inputAsset, amount, slippageBps: slippage };
        const cachedQuote = multiHopQuoteCache.get(cacheKey);

        if (cachedQuote) {
          fastify.log.info({ tokenAddress, inputAsset, amount }, '💰 [BondingQuote] Cache hit');
          return reply.send({
            success: true,
            data: cachedQuote,
          });
        }

        // If input is ACES, no multi-hop needed
        if (inputAsset === 'ACES') {
          fastify.log.info('✅ [BondingQuote] Direct ACES input - no multi-hop needed');
          const response = {
            inputAsset: 'ACES',
            inputAmount: amount,
            expectedAcesAmount: amount,
            expectedRwaOutput: '0',
            path: ['ACES', tokenAddress.toLowerCase()],
            needsMultiHop: false,
            slippageBps: slippage,
          } as MultiHopQuoteResponse;

          // Cache the response
          multiHopQuoteCache.set(cacheKey, response);

          return reply.send({
            success: true,
            data: response,
          });
        }

        // Setup network and provider
        const networkConfig = getNetworkConfig(8453);
        const acesAddress = networkConfig.acesToken;
        const provider = createProvider(8453);

        if (!provider) {
          fastify.log.error('❌ [BondingQuote] RPC provider not available');
          return reply.code(500).send({
            success: false,
            error: 'RPC provider not available',
          });
        }

        fastify.log.info('✅ [BondingQuote] Provider initialized');

        // Asset metadata
        const assetMetadata = {
          ACES: {
            symbol: 'ACES' as const,
            address: acesAddress.toLowerCase(),
            decimals: 18,
          },
          USDC: {
            symbol: 'USDC' as const,
            address: (
              process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
            ).toLowerCase(),
            decimals: 6,
          },
          USDT: {
            symbol: 'USDT' as const,
            address: (
              process.env.USDT_ADDRESS || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
            ).toLowerCase(),
            decimals: 6,
          },
          WETH: {
            symbol: 'WETH' as const,
            address: (
              process.env.WETH_ADDRESS || '0x4200000000000000000000000000000000000006'
            ).toLowerCase(),
            decimals: 18,
          },
        } as const;

        // Known pool addresses on Base Mainnet (Uniswap V2 style pools only)
        const knownPools = {
          'WETH-ACES': '0x2f97bbd562ba6c4d298b370929ea20291aff9ff5',
          'USDC-WETH': '0xcdac0d6c6c59727a65f871236188350531885c43',
        };

        // Helper function to read pool reserves directly with Caching + Coalescing
        const getPoolReservesDirect = async (
          poolAddress: string,
          tokenIn: string,
          tokenOut: string,
        ): Promise<{
          poolAddress: string;
          reserveIn: bigint;
          reserveOut: bigint;
          decimalsIn: number;
          decimalsOut: number;
        } | null> => {
          const cacheKey = `${poolAddress.toLowerCase()}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
          const now = Date.now();

          // 1. Check Cache
          const cached = poolReservesCache.get(cacheKey);
          if (cached && now - cached.timestamp < POOL_RESERVES_TTL) {
            return {
              poolAddress,
              reserveIn: cached.reserveIn,
              reserveOut: cached.reserveOut,
              decimalsIn: cached.decimalsIn,
              decimalsOut: cached.decimalsOut,
            };
          }

          // 2. Check Pending Requests (Coalescing)
          const pending = poolReservesPending.get(cacheKey);
          if (pending) {
            return pending;
          }

          // 3. Fetch New Data
          const fetchPromise = (async () => {
            try {
              const PAIR_ABI = [
                'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
                'function token0() view returns (address)',
                'function token1() view returns (address)',
              ];

              fastify.log.debug(
                { poolAddress, tokenIn, tokenOut },
                '🔍 [BondingQuote] Fetching pool reserves (RPC)',
              );

              const pairContract = new ethers.Contract(poolAddress, PAIR_ABI, provider);
              const [reserve0, reserve1] = await pairContract.getReserves();
              const token0 = ((await pairContract.token0()) as string).toLowerCase();
              const token1 = ((await pairContract.token1()) as string).toLowerCase();

              const normalizedIn = tokenIn.toLowerCase();
              const normalizedOut = tokenOut.toLowerCase();

              let reserveIn: bigint;
              let reserveOut: bigint;

              if (token0 === normalizedIn && token1 === normalizedOut) {
                reserveIn = BigInt(reserve0.toString());
                reserveOut = BigInt(reserve1.toString());
              } else if (token0 === normalizedOut && token1 === normalizedIn) {
                reserveIn = BigInt(reserve1.toString());
                reserveOut = BigInt(reserve0.toString());
              } else {
                fastify.log.error('❌ [BondingQuote] Token mismatch in pool');
                return null;
              }

              // Get decimals (cached effectively by generic token info if we had it, but cheap enough here usually or we could cache)
              // For now, we'll assume standard known tokens have known decimals to save RPC calls if possible
              // but strictly we should check. To save RPCs, let's hardcode known decimals for base tokens
              let decimalsIn = 18;
              let decimalsOut = 18;

              if (normalizedIn === assetMetadata.USDC.address) decimalsIn = 6;
              else if (normalizedIn === assetMetadata.USDT.address) decimalsIn = 6;

              if (normalizedOut === assetMetadata.USDC.address) decimalsOut = 6;
              else if (normalizedOut === assetMetadata.USDT.address) decimalsOut = 6;

              // Cache the result
              const result = {
                poolAddress,
                reserveIn,
                reserveOut,
                decimalsIn,
                decimalsOut,
              };

              poolReservesCache.set(cacheKey, { ...result, timestamp: Date.now() });
              return result;
            } catch (error) {
              fastify.log.error(
                { err: error, poolAddress },
                '❌ [BondingQuote] Failed to read pool reserves',
              );
              return null;
            } finally {
              poolReservesPending.delete(cacheKey);
            }
          })();

          poolReservesPending.set(cacheKey, fetchPromise);
          return fetchPromise;
        };

        const inputConfig = assetMetadata[inputAsset as keyof typeof assetMetadata];
        if (!inputConfig) {
          fastify.log.warn({ inputAsset }, '❌ [BondingQuote] Unsupported input asset');
          return reply.code(400).send({
            success: false,
            error: `Unsupported input asset: ${inputAsset}`,
          });
        }

        if (!amount) {
          return reply.code(400).send({
            success: false,
            error: 'Amount is required',
          });
        }

        let amountInRaw: bigint;
        try {
          amountInRaw = ethers.parseUnits(amount, inputConfig.decimals);
        } catch (error) {
          fastify.log.warn(
            { amount, decimals: inputConfig.decimals, err: error },
            '❌ [BondingQuote] Amount precision exceeds token decimals',
          );
          return reply.code(400).send({
            success: false,
            error: `Amount has more than ${inputConfig.decimals} decimal places`,
          });
        }

        // Apply slippage to input amount (reduce to ensure transaction success)
        const amountInWithSlippage = (amountInRaw * BigInt(10000 - slippage)) / BigInt(10000);

        fastify.log.info(
          {
            symbol: inputConfig.symbol,
            address: inputConfig.address,
            decimals: inputConfig.decimals,
            amountInRaw: amountInRaw.toString(),
            amountInWithSlippage: amountInWithSlippage.toString(),
            slippage,
          },
          '💰 [BondingQuote] Input configuration with slippage',
        );

        // Constant product formula with 0.3% fee
        const computeSwap = (amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint => {
          if (reserveIn === 0n || reserveOut === 0n) {
            fastify.log.warn('⚠️ [BondingQuote] Zero reserves detected');
            return 0n;
          }
          const feeNumerator = 997n;
          const feeDenominator = 1000n;
          const amountInWithFee = (amountIn * feeNumerator) / feeDenominator;
          const numerator = amountInWithFee * reserveOut;
          const denominator = reserveIn + amountInWithFee;
          const result = denominator === 0n ? 0n : numerator / denominator;

          fastify.log.debug(
            {
              amountIn: amountIn.toString(),
              reserveIn: reserveIn.toString(),
              reserveOut: reserveOut.toString(),
              result: result.toString(),
            },
            '🔢 [BondingQuote] Swap calculation',
          );

          return result;
        };

        let acesAmountRaw = 0n;
        let routePath: string[] = [];
        const intermediateSteps: Array<{ symbol: string; amount: string }> = [];

        // Route based on input asset
        if (inputAsset === 'WETH') {
          fastify.log.info('🔄 [BondingQuote] Computing WETH → ACES');

          const wethAcesPool = knownPools['WETH-ACES'];
          const wethToAces = await getPoolReservesDirect(
            wethAcesPool,
            assetMetadata.WETH.address,
            assetMetadata.ACES.address,
          );

          if (!wethToAces) {
            fastify.log.error(
              { poolAddress: wethAcesPool },
              '❌ [BondingQuote] Failed to read WETH/ACES pool',
            );

            return reply.code(404).send({
              success: false,
              error: 'WETH/ACES pool not found or not readable.',
            });
          }

          acesAmountRaw = computeSwap(
            amountInWithSlippage,
            wethToAces.reserveIn,
            wethToAces.reserveOut,
          );
          routePath = [
            assetMetadata.WETH.address,
            assetMetadata.ACES.address,
            tokenAddress.toLowerCase(),
          ];

          fastify.log.info(
            {
              inputWETH: amount,
              outputACES: ethers.formatUnits(acesAmountRaw, 18),
            },
            '✅ [BondingQuote] WETH → ACES result',
          );
        } else if (inputAsset === 'USDC') {
          fastify.log.info('🔄 [BondingQuote] Computing USDC → WETH → ACES');

          // Step 1: USDC → WETH
          fastify.log.info('🔍 [BondingQuote] Step 1: USDC → WETH');

          const usdcWethPool = knownPools['USDC-WETH'];
          const stableToWeth = await getPoolReservesDirect(
            usdcWethPool,
            inputConfig.address,
            assetMetadata.WETH.address,
          );

          if (!stableToWeth) {
            fastify.log.error(
              { poolAddress: usdcWethPool },
              '❌ [BondingQuote] Failed to read USDC/WETH pool',
            );

            return reply.code(404).send({
              success: false,
              error: 'USDC/WETH pool not found or not readable.',
            });
          }

          const wethAmountRaw = computeSwap(
            amountInWithSlippage,
            stableToWeth.reserveIn,
            stableToWeth.reserveOut,
          );

          intermediateSteps.push({
            symbol: 'WETH',
            amount: ethers.formatUnits(wethAmountRaw, assetMetadata.WETH.decimals),
          });

          fastify.log.info(
            {
              input: `${amount} USDC`,
              output: `${ethers.formatUnits(wethAmountRaw, 18)} WETH`,
            },
            '✅ [BondingQuote] USDC → WETH',
          );

          // Step 2: WETH → ACES
          fastify.log.info('🔍 [BondingQuote] Step 2: WETH → ACES');

          const wethAcesPool = knownPools['WETH-ACES'];
          const wethToAces = await getPoolReservesDirect(
            wethAcesPool,
            assetMetadata.WETH.address,
            assetMetadata.ACES.address,
          );

          if (!wethToAces) {
            fastify.log.error(
              { poolAddress: wethAcesPool },
              '❌ [BondingQuote] Failed to read WETH/ACES pool',
            );

            return reply.code(404).send({
              success: false,
              error: 'WETH/ACES pool not found or not readable.',
            });
          }

          acesAmountRaw = computeSwap(wethAmountRaw, wethToAces.reserveIn, wethToAces.reserveOut);

          fastify.log.info(
            {
              input: `${ethers.formatUnits(wethAmountRaw, 18)} WETH`,
              output: `${ethers.formatUnits(acesAmountRaw, 18)} ACES`,
            },
            '✅ [BondingQuote] WETH → ACES',
          );

          routePath = [
            inputConfig.address,
            assetMetadata.WETH.address,
            assetMetadata.ACES.address,
            tokenAddress.toLowerCase(),
          ];
        } else if (inputAsset === 'USDT') {
          // Treat USDT as USDC since they're both stablecoins with ~1:1 value
          // Use the same USDC → WETH → ACES path
          fastify.log.info('🔄 [BondingQuote] Computing USDT → WETH → ACES (using USDC pools)');

          // Step 1: USDT → WETH (using USDC/WETH pool since USDT ≈ USDC)
          fastify.log.info('🔍 [BondingQuote] Step 1: USDT → WETH (via USDC pool proxy)');

          const usdcWethPool = knownPools['USDC-WETH'];
          const stableToWeth = await getPoolReservesDirect(
            usdcWethPool,
            assetMetadata.USDC.address, // Use USDC pool address
            assetMetadata.WETH.address,
          );

          if (!stableToWeth) {
            fastify.log.error(
              { poolAddress: usdcWethPool },
              '❌ [BondingQuote] Failed to read USDC/WETH pool for USDT quote',
            );

            return reply.code(404).send({
              success: false,
              error: 'USDC/WETH pool not found or not readable.',
            });
          }

          const wethAmountRaw = computeSwap(
            amountInWithSlippage,
            stableToWeth.reserveIn,
            stableToWeth.reserveOut,
          );

          intermediateSteps.push({
            symbol: 'WETH',
            amount: ethers.formatUnits(wethAmountRaw, assetMetadata.WETH.decimals),
          });

          fastify.log.info(
            {
              input: `${amount} USDT`,
              output: `${ethers.formatUnits(wethAmountRaw, 18)} WETH`,
              note: 'Using USDC pool (USDT ≈ USDC)',
            },
            '✅ [BondingQuote] USDT → WETH',
          );

          // Step 2: WETH → ACES
          fastify.log.info('🔍 [BondingQuote] Step 2: WETH → ACES');

          const wethAcesPool = knownPools['WETH-ACES'];
          const wethToAces = await getPoolReservesDirect(
            wethAcesPool,
            assetMetadata.WETH.address,
            assetMetadata.ACES.address,
          );

          if (!wethToAces) {
            fastify.log.error(
              { poolAddress: wethAcesPool },
              '❌ [BondingQuote] Failed to read WETH/ACES pool',
            );

            return reply.code(404).send({
              success: false,
              error: 'WETH/ACES pool not found or not readable.',
            });
          }

          acesAmountRaw = computeSwap(wethAmountRaw, wethToAces.reserveIn, wethToAces.reserveOut);

          fastify.log.info(
            {
              input: `${ethers.formatUnits(wethAmountRaw, 18)} WETH`,
              output: `${ethers.formatUnits(acesAmountRaw, 18)} ACES`,
            },
            '✅ [BondingQuote] WETH → ACES',
          );

          routePath = [
            inputConfig.address, // USDT
            assetMetadata.WETH.address, // WETH
            assetMetadata.ACES.address, // ACES
            tokenAddress.toLowerCase(), // RWA token
          ];
        }

        if (acesAmountRaw === 0n) {
          fastify.log.error('❌ [BondingQuote] Zero ACES output - insufficient liquidity');
          return reply.code(400).send({
            success: false,
            error: 'Insufficient liquidity for this trade size',
          });
        }

        // Apply slippage to ACES amount
        const minAcesAmountRaw = (acesAmountRaw * BigInt(10_000 - slippage)) / 10_000n;

        // Calculate final RWA token output using bonding curve
        fastify.log.info('🔄 [BondingQuote] Calculating ACES → RWA token output');

        const factoryProxyAddress = networkConfig.acesFactoryProxy;
        if (!factoryProxyAddress) {
          fastify.log.error('❌ [BondingQuote] Factory proxy not configured');
          return reply.code(500).send({
            success: false,
            error: 'Factory proxy not configured',
          });
        }

        // 🔥 OPTIMIZATION: Use local math instead of RPC binary search
        // This reduces 10-20 RPC calls to 0-1 (cached supply)

        // 1. Get Token Info (Steepness/Floor) - Cached
        let tokenInfo = tokenInfoCache.get(tokenAddress);
        if (!tokenInfo || Date.now() - tokenInfo.timestamp > TOKEN_INFO_TTL) {
          const factoryContract = new ethers.Contract(factoryProxyAddress, FACTORY_ABI, provider);
          const info = await factoryContract.tokens(tokenAddress);
          tokenInfo = {
            steepness: info.steepness,
            floor: info.floor,
            tokenBonded: info.tokenBonded,
            timestamp: Date.now(),
          };
          tokenInfoCache.set(tokenAddress, tokenInfo);
        }

        // Check if token is bonded
        if (tokenInfo.tokenBonded) {
          return reply.code(400).send({
            success: false,
            error: 'Token is fully bonded, use DEX mode',
          });
        }

        // Get token decimals
        const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
        const tokenDecimals = Number(await tokenContract.decimals());

        let expectedRwaOutput = '0';

        try {
          // Use the optimized math library
          const { expectedOutput } = await getOptimizedQuote({
            tokenAddress,
            inputAsset: 'ACES', // We are always converting ACES -> Token here
            amount: ethers.formatUnits(acesAmountRaw, 18), // Convert BigInt wei to string ether
            tokenDecimals,
            steepness: tokenInfo.steepness,
            floor: tokenInfo.floor,
            provider,
          });

          expectedRwaOutput = expectedOutput;

          fastify.log.info(
            {
              acesAmount: ethers.formatUnits(acesAmountRaw, 18),
              rwaTokens: expectedRwaOutput,
            },
            '✅ [BondingQuote] ACES → RWA calculation complete (Optimized Math)',
          );
        } catch (error) {
          fastify.log.error(
            { err: error },
            '❌ [BondingQuote] Failed to calculate RWA token output',
          );
          // Continue with 0 output rather than failing the whole request
          expectedRwaOutput = '0';
        }

        // Calculate USD values
        let inputUsdValue: string | null = null;
        let outputUsdValue: string | null = null;

        try {
          // Use price cache service directly instead of making HTTP call to self
          const priceData = await priceCacheService.getPrices();
          const acesUsd = priceData.acesUsd;
          const wethUsd = priceData.wethUsd;
          const usdcUsd = priceData.usdcUsd;
          const usdtUsd = priceData.usdtUsd;

          if (acesUsd > 0) {
            // Calculate input USD value based on input asset
            if (inputAsset === 'WETH' && wethUsd > 0) {
              inputUsdValue = (amountNum * wethUsd).toFixed(2);
            } else if (inputAsset === 'USDC' && usdcUsd > 0) {
              inputUsdValue = (amountNum * usdcUsd).toFixed(2);
            } else if (inputAsset === 'USDT' && usdtUsd > 0) {
              inputUsdValue = (amountNum * usdtUsd).toFixed(2);
            }

            // Calculate output USD value based on ACES being spent to buy RWA tokens
            // The RWA tokens are purchased with acesAmountRaw ACES
            // So output value = ACES spent * ACES USD price
            const acesSpentNum = parseFloat(ethers.formatUnits(acesAmountRaw, 18));
            outputUsdValue = (acesSpentNum * acesUsd).toFixed(2);
          }
        } catch (error) {
          fastify.log.warn(
            { error },
            '⚠️ [BondingQuote] Failed to fetch USD prices for multi-hop quote',
          );
        }

        const response: MultiHopQuoteResponse = {
          inputAsset: inputAsset as 'ACES' | 'WETH' | 'ETH' | 'USDC' | 'USDT',
          inputAmount: amount,
          inputAmountRaw: amountInRaw.toString(),
          expectedAcesAmount: ethers.formatUnits(acesAmountRaw, 18),
          expectedAcesAmountRaw: acesAmountRaw.toString(),
          minAcesAmount: ethers.formatUnits(minAcesAmountRaw, 18),
          minAcesAmountRaw: minAcesAmountRaw.toString(),
          expectedRwaOutput,
          path: routePath,
          intermediate: intermediateSteps.length ? intermediateSteps : undefined,
          slippageBps: slippage,
          needsMultiHop: true,
          inputUsdValue,
          outputUsdValue,
        };

        fastify.log.info(
          {
            inputAsset: response.inputAsset,
            inputAmount: response.inputAmount,
            expectedAcesAmount: response.expectedAcesAmount,
            minAcesAmount: response.minAcesAmount,
            expectedRwaOutput: response.expectedRwaOutput,
            inputUsdValue: response.inputUsdValue,
            outputUsdValue: response.outputUsdValue,
            path: response.path,
            intermediateSteps: response.intermediate,
          },
          '✅ [BondingQuote] Final response',
        );

        // Store in cache for future requests
        multiHopQuoteCache.set(cacheKey, response);

        fastify.log.info(
          { tokenAddress, inputAsset, amount },
          '✅ [BondingQuote] Multi-hop quote computed and cached',
        );

        return reply.send({
          success: true,
          data: response,
        });
      } catch (error) {
        fastify.log.error(
          { err: error },
          '❌ [BondingQuote] Failed to compute bonding multi-hop quote',
        );
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to calculate quote',
        });
      }
    },
  );
}
