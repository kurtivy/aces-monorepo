import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ethers } from 'ethers';
import { getNetworkConfig } from '../../config/network.config';
import { getProvider } from '../../lib/provider-manager';
import { AerodromeDataService } from '../../services/aerodrome-data-service';
import { priceCacheService } from '../../services/price-cache-service';
import {
  quoteBuyAmountFromAces,
  quoteSellAcesFromAmount,
  getBuyPriceAfterFee,
  type QuoteState,
} from '../../services/bonding-curve-formula';
import type { UnifiedTokenData } from '../../services/unified-goldsky-data-service';
import {
  retryRpcCall,
  isRateLimitError,
  getRateLimitErrorMessage,
} from '../../lib/rpc-rate-limit-handler';

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
  inputAsset: 'ACES' | 'WETH' | 'USDC' | 'USDT';
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
  'function protocolFeePercent() view returns (uint256)',
  'function subjectFeePercent() view returns (uint256)',
  'function tokens(address) view returns (uint8 curve, address tokenAddress, uint256 floor, uint256 steepness, uint256 acesTokenBalance, address subjectFeeDestination, uint256 tokensBondedAt, bool tokenBonded)',
];

const TOKEN_ABI = [
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
];

/**
 * Bonding curve quote routes
 * Handles both direct ACES ↔ TOKEN quotes and multi-hop quotes
 */
export async function bondingRoutes(fastify: FastifyInstance) {
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

        // 🔥 PHASE 5: Cache entire quote result (prevents 50 RPC calls per request!)
        // Cache key includes all parameters that affect the quote
        const normalizedToken = tokenAddress.toLowerCase();
        const cacheKey = `bonding-quote:${normalizedToken}:${inputAsset}:${amount}:${slippage}`;
        const CACHE_TTL = 2000; // 2 seconds - short TTL for price-sensitive data

        // Track cache stats before to determine if this is a hit
        const statsBefore = fastify.cache.getStats();

        const quoteResult = await fastify.cache.getOrFetch<{
          success: boolean;
          data?: DirectQuoteResponse;
          error?: string;
        }>(
          'quotes',
          cacheKey,
          async () => {
            // Quote calculation logic (moved inside cache callback)
            return await calculateDirectBondingQuote(
              fastify,
              tokenAddress,
              inputAsset,
              amount,
              slippage,
            );
          },
          CACHE_TTL,
        );

        // Determine if this was a cache hit
        const statsAfter = fastify.cache.getStats();
        const wasCached = statsAfter.hits > statsBefore.hits;

        if (!quoteResult.success) {
          return reply.code(quoteResult.error?.includes('Insufficient') ? 400 : 500).send({
            success: false,
            error: quoteResult.error || 'Failed to calculate quote',
            cached: wasCached,
          });
        }

        return reply.send({
          success: true,
          data: quoteResult.data,
          cached: wasCached,
        });
      } catch (error) {
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

  /**
   * Get factory fee percentages (cached for 5 minutes)
   * These rarely change, so we cache them aggressively
   */
  async function getFactoryFeePercentages(
    fastify: FastifyInstance,
    factoryContract: ethers.Contract,
  ): Promise<{ protocolFeePercent: bigint; subjectFeePercent: bigint }> {
    const cacheKey = 'factory-fee-percentages';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    const cached = fastify.cache.get<{ protocolFeePercent: bigint; subjectFeePercent: bigint }>(
      'other',
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    // Fetch from contract
    const [protocolFeePercent, subjectFeePercent] = await Promise.all([
      factoryContract.protocolFeePercent(),
      factoryContract.subjectFeePercent(),
    ]);

    const result = {
      protocolFeePercent: BigInt(protocolFeePercent.toString()),
      subjectFeePercent: BigInt(subjectFeePercent.toString()),
    };

    // Cache for 5 minutes
    fastify.cache.set('other', cacheKey, result, CACHE_TTL);

    return result;
  }

  // 🔥 PHASE 5: Extract quote calculation logic to separate function
  // This allows caching to wrap the entire calculation
  async function calculateDirectBondingQuote(
    fastify: FastifyInstance,
    tokenAddress: string,
    inputAsset: string,
    amount: string,
    slippage: number,
  ): Promise<{ success: boolean; data?: DirectQuoteResponse; error?: string }> {
    try {
      // Setup network and provider
      const networkConfig = getNetworkConfig(8453);
      const acesAddress = networkConfig.acesToken;
      const factoryProxyAddress = networkConfig.acesFactoryProxy;
      const provider = getProvider(8453); // 🔥 Use shared provider manager

      console.log('🏭 Factory configuration:', {
        factoryProxyAddress,
        acesAddress,
        hasProvider: !!provider,
      });

      if (!provider) {
        fastify.log.error('❌ [DirectBondingQuote] RPC provider not available');
        return { success: false, error: 'RPC provider not available' };
      }

      if (!factoryProxyAddress) {
        fastify.log.error('❌ [DirectBondingQuote] Factory proxy not configured');
        return { success: false, error: 'Factory proxy not configured' };
      }

      // Initialize contracts
      const factoryContract = new ethers.Contract(factoryProxyAddress, FACTORY_ABI, provider);
      const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);

      // Get token decimals - wrap with retry logic
      let tokenDecimals: number;
      try {
        tokenDecimals = Number(
          await retryRpcCall(() => tokenContract.decimals(), {
            maxRetries: 3,
            logger: fastify.log,
            operationName: `tokenContract.decimals(${tokenAddress})`,
          }),
        );
      } catch (error) {
        if (isRateLimitError(error)) {
          fastify.log.error(
            { err: error, tokenAddress },
            '❌ [DirectBondingQuote] Rate limit error reading token decimals',
          );
          return {
            success: false,
            error: getRateLimitErrorMessage(error),
          };
        }
        throw error;
      }

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
                const contractTokenInfo = await retryRpcCall(
                  () => factoryContract.tokens(tokenAddress),
                  {
                    maxRetries: 3,
                    logger: fastify.log,
                    operationName: `factoryContract.tokens(${tokenAddress})`,
                  },
                );
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
                    return { success: false, error: 'Token is fully bonded, use DEX mode' };
                  }
                } else {
                  console.log('⚠️ Contract returned zero address, using subgraph data');
                }
              } catch (contractError) {
                // Check if it's a rate limit error
                if (isRateLimitError(contractError)) {
                  fastify.log.warn(
                    { err: contractError },
                    '⚠️ Rate limit error verifying contract, using subgraph data',
                  );
                } else {
                  console.warn(
                    '⚠️ Could not verify from contract, using subgraph data:',
                    contractError,
                  );
                }
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
        try {
          tokenInfo = await retryRpcCall(() => factoryContract.tokens(tokenAddress), {
            maxRetries: 3,
            logger: fastify.log,
            operationName: `factoryContract.tokens(${tokenAddress})`,
          });
        } catch (error) {
          if (isRateLimitError(error)) {
            fastify.log.error(
              { err: error, tokenAddress },
              '❌ [DirectBondingQuote] Rate limit error reading token info',
            );
            return {
              success: false,
              error: getRateLimitErrorMessage(error),
            };
          }
          throw error;
        }

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
          return { success: false, error: 'Token is fully bonded, use DEX mode' };
        }

        // Check if token exists (tokenAddress should not be zero address)
        if (tokenInfo.tokenAddress === '0x0000000000000000000000000000000000000000') {
          fastify.log.error({ tokenAddress }, '❌ Token not found in factory');
          return { success: false, error: 'Token not found or not registered with bonding curve' };
        }
      }

      // Validate bonding curve parameters
      if (!tokenParams) {
        fastify.log.error(
          { tokenAddress },
          '❌ No token params available from subgraph or contract',
        );
        return { success: false, error: 'Token not found or not registered with bonding curve' };
      }

      if (tokenParams.steepness === 0n) {
        fastify.log.error({ tokenAddress }, '❌ Token has zero steepness - invalid bonding curve');
        return { success: false, error: 'Invalid token: bonding curve has zero steepness' };
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

        return {
          success: false,
          error:
            'This token is on a different factory version. Direct quotes are not available. Please use DEX mode or wait for backend update.',
        };
      }

      if (inputAsset === 'ACES') {
        // ACES → TOKEN (buy)
        // 🔥 FORMULA-BASED CALCULATION: Zero RPC calls during binary search!
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
          '🔄 [DirectBondingQuote] Calculating ACES → TOKEN via formula (no RPC calls)',
        );

        // Get fee percentages (cached for 5 minutes)
        const feePercentages = await getFactoryFeePercentages(fastify, factoryContract);

        // Get current supply - try unifiedGoldSkyService first, then cache totalSupply()
        let currentSupply: bigint;
        const unifiedData = await (
          fastify as {
            unifiedGoldSkyService: {
              getUnifiedTokenData: (address: string) => Promise<UnifiedTokenData | null>;
            };
          }
        ).unifiedGoldSkyService?.getUnifiedTokenData(tokenAddress);

        if (unifiedData?.trades && unifiedData.trades.length > 0) {
          // Use supply from latest trade (most accurate)
          const latestTrade = unifiedData.trades[0];
          // Supply from trades is in token units (already formatted), convert to wei
          const supplyInTokens = BigInt(Math.floor(parseFloat(latestTrade.supply)));
          currentSupply = supplyInTokens * BigInt(10) ** BigInt(tokenDecimals);
          fastify.log.debug(
            { supply: latestTrade.supply, currentSupply: currentSupply.toString() },
            '✅ [DirectBondingQuote] Using supply from unified data',
          );
        } else {
          // Fallback: cache totalSupply() for 2 seconds
          const supplyCacheKey = `token-supply:${tokenAddress.toLowerCase()}`;
          const cachedSupply = fastify.cache.get<bigint>('other', supplyCacheKey);
          if (cachedSupply) {
            currentSupply = cachedSupply;
          } else {
            try {
              currentSupply = await retryRpcCall(() => tokenContract.totalSupply(), {
                maxRetries: 3,
                logger: fastify.log,
                operationName: `tokenContract.totalSupply(${tokenAddress})`,
              });
            } catch (error) {
              if (isRateLimitError(error)) {
                fastify.log.error(
                  { err: error, tokenAddress },
                  '❌ [DirectBondingQuote] Rate limit error reading token supply',
                );
                return {
                  success: false,
                  error: getRateLimitErrorMessage(error),
                };
              }
              throw error;
            }
            fastify.cache.set('other', supplyCacheKey, currentSupply, 2000); // 2s TTL
          }
          fastify.log.debug(
            { supply: currentSupply.toString() },
            '✅ [DirectBondingQuote] Using supply from RPC (cached)',
          );
        }

        // Get token info for max supply and bonding status
        if (!tokenInfo) {
          try {
            tokenInfo = await retryRpcCall(() => factoryContract.tokens(tokenAddress), {
              maxRetries: 3,
              logger: fastify.log,
              operationName: `factoryContract.tokens(${tokenAddress})`,
            });
          } catch (error) {
            if (isRateLimitError(error)) {
              fastify.log.error(
                { err: error, tokenAddress },
                '❌ [DirectBondingQuote] Rate limit error reading token info',
              );
              return {
                success: false,
                error: getRateLimitErrorMessage(error),
              };
            }
            throw error;
          }
        }

        // Get max supply (default to 1B if not available)
        const oneToken = ethers.parseUnits('1', tokenDecimals);
        const W = BigInt(10) ** BigInt(18);
        let launchpadMaxSupply = BigInt(10) ** BigInt(9) * W; // Default 1B tokens
        try {
          // Try to get MAX_TOTAL_SUPPLY from token contract
          const tokenContractWithMaxSupply = new ethers.Contract(
            tokenAddress,
            [...TOKEN_ABI, 'function MAX_TOTAL_SUPPLY() view returns (uint256)'],
            provider,
          );
          launchpadMaxSupply = await retryRpcCall(
            () => tokenContractWithMaxSupply.MAX_TOTAL_SUPPLY(),
            {
              maxRetries: 3,
              logger: fastify.log,
              operationName: `tokenContract.MAX_TOTAL_SUPPLY(${tokenAddress})`,
            },
          );
        } catch (error) {
          // Only log rate limit errors, otherwise use default silently
          if (isRateLimitError(error)) {
            fastify.log.warn(
              { err: error, tokenAddress },
              '⚠️ [MultiHopQuote] Rate limit error reading MAX_TOTAL_SUPPLY, using default',
            );
          }
          // Use default if not available or rate limited
        }

        // Build quote state for formula
        // Formula expects supply in 18 decimals (wei), not token decimals
        const quoteState: QuoteState = {
          supply: (currentSupply / BigInt(10) ** BigInt(tokenDecimals)) * BigInt(10) ** BigInt(18), // Convert to 18 decimals
          steepness: tokenParams.steepness,
          floor: tokenParams.floor,
          protocolFeePercent: feePercentages.protocolFeePercent,
          subjectFeePercent: feePercentages.subjectFeePercent,
          tokenBonded: tokenInfo?.tokenBonded || false,
          tokensBondedAt: tokenInfo?.tokensBondedAt || 0n,
          launchpadMaxSupply: launchpadMaxSupply / BigInt(10) ** BigInt(18 - tokenDecimals), // Convert to token decimals
        };

        // Use formula-based binary search (no RPC calls!)
        const tokenAmountWei = quoteBuyAmountFromAces(acesInputWithSlippage, quoteState);

        if (tokenAmountWei === 0n) {
          // Check if user can afford at least 1 token using formula
          const W = BigInt(10) ** BigInt(18);
          const oneTokenWei = W; // Formula expects 18 decimals
          const costForOne = getBuyPriceAfterFee(
            quoteState.supply,
            oneTokenWei,
            quoteState.steepness,
            quoteState.floor,
            quoteState.protocolFeePercent,
            quoteState.subjectFeePercent,
          );
          if (costForOne > acesInputWithSlippage) {
            return {
              success: false,
              error: `Insufficient ACES. Need at least ${ethers.formatEther(costForOne)} ACES to buy 1 token (after ${slippage / 100}% slippage)`,
            };
          }
        }

        expectedOutput = ethers.formatUnits(tokenAmountWei, tokenDecimals);
        outputAsset = tokenAddress;

        fastify.log.info(
          { input: `${amount} ACES`, output: `${expectedOutput} TOKEN` },
          '✅ [DirectBondingQuote] ACES → TOKEN calculated (formula-based, zero RPC calls)',
        );
      } else {
        // TOKEN → ACES (sell)
        // 🔥 FORMULA-BASED CALCULATION: Zero RPC calls!
        const amountWei = ethers.parseUnits(amount, tokenDecimals);

        fastify.log.info(
          { amountWei: amountWei.toString(), amount, tokenDecimals },
          '🔄 [DirectBondingQuote] Calculating TOKEN → ACES via formula (no RPC calls)',
        );

        // Get fee percentages (cached for 5 minutes)
        const feePercentages = await getFactoryFeePercentages(fastify, factoryContract);

        // Get current supply - try unifiedGoldSkyService first, then cache totalSupply()
        let currentSupply: bigint;
        const unifiedData = await (
          fastify as {
            unifiedGoldSkyService: {
              getUnifiedTokenData: (address: string) => Promise<UnifiedTokenData | null>;
            };
          }
        ).unifiedGoldSkyService?.getUnifiedTokenData(tokenAddress);

        if (unifiedData?.trades && unifiedData.trades.length > 0) {
          const latestTrade = unifiedData.trades[0];
          const supplyInTokens = BigInt(Math.floor(parseFloat(latestTrade.supply)));
          currentSupply = supplyInTokens * BigInt(10) ** BigInt(tokenDecimals);
        } else {
          const supplyCacheKey = `token-supply:${tokenAddress.toLowerCase()}`;
          const cachedSupply = fastify.cache.get<bigint>('other', supplyCacheKey);
          if (cachedSupply) {
            currentSupply = cachedSupply;
          } else {
            try {
              currentSupply = await retryRpcCall(() => tokenContract.totalSupply(), {
                maxRetries: 3,
                logger: fastify.log,
                operationName: `tokenContract.totalSupply(${tokenAddress})`,
              });
            } catch (error) {
              if (isRateLimitError(error)) {
                fastify.log.error(
                  { err: error, tokenAddress },
                  '❌ [DirectBondingQuote] Rate limit error reading token supply',
                );
                return {
                  success: false,
                  error: getRateLimitErrorMessage(error),
                };
              }
              throw error;
            }
            fastify.cache.set('other', supplyCacheKey, currentSupply, 2000);
          }
        }

        // Get token info if not already fetched
        if (!tokenParams) {
          if (!tokenInfo) {
            try {
              tokenInfo = await retryRpcCall(() => factoryContract.tokens(tokenAddress), {
                maxRetries: 3,
                logger: fastify.log,
                operationName: `factoryContract.tokens(${tokenAddress})`,
              });
            } catch (error) {
              if (isRateLimitError(error)) {
                fastify.log.error(
                  { err: error, tokenAddress },
                  '❌ [DirectBondingQuote] Rate limit error reading token info',
                );
                return {
                  success: false,
                  error: getRateLimitErrorMessage(error),
                };
              }
              throw error;
            }
          }
          tokenParams = {
            steepness: tokenInfo.steepness,
            floor: tokenInfo.floor,
          };
        }

        // Build quote state for formula
        // Formula expects supply in 18 decimals (wei)
        const quoteState: QuoteState = {
          supply: (currentSupply / BigInt(10) ** BigInt(tokenDecimals)) * BigInt(10) ** BigInt(18), // Convert to 18 decimals
          steepness: tokenParams.steepness,
          floor: tokenParams.floor,
          protocolFeePercent: feePercentages.protocolFeePercent,
          subjectFeePercent: feePercentages.subjectFeePercent,
          tokenBonded: tokenInfo?.tokenBonded || false,
          tokensBondedAt: tokenInfo?.tokensBondedAt || 0n,
          launchpadMaxSupply: BigInt(10) ** BigInt(9) * BigInt(10) ** BigInt(18), // Default 1B in 18 decimals (not used for sell)
        };

        // Use formula-based calculation (no RPC calls!)
        // Formula expects amount in 18 decimals
        const amountWeiInTokenUnits = amountWei / BigInt(10) ** BigInt(tokenDecimals);
        const amountWeiIn18Decimals = amountWeiInTokenUnits * BigInt(10) ** BigInt(18);
        const acesWei = quoteSellAcesFromAmount(amountWeiIn18Decimals, quoteState);

        expectedOutput = ethers.formatEther(acesWei);
        outputAsset = acesAddress;

        fastify.log.info(
          { input: `${amount} TOKEN`, output: `${expectedOutput} ACES` },
          '✅ [DirectBondingQuote] TOKEN → ACES calculated (formula-based, zero RPC calls)',
        );
      }

      // Get ACES USD price for USD value calculation
      let inputUsdValue: string | null = null;
      let outputUsdValue: string | null = null;

      try {
        // Use price cache service directly instead of making HTTP call to self
        const priceData = await priceCacheService.getPrices();
        const acesUsd = priceData.acesUsd;

        if (acesUsd > 0) {
          const amountNum = parseFloat(amount);
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

      return { success: true, data: response };
    } catch (error) {
      fastify.log.error(
        { err: error },
        '❌ [DirectBondingQuote] Failed to compute direct bonding quote',
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate quote',
      };
    }
  }

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
            inputAsset: z.enum(['ACES', 'WETH', 'USDC', 'USDT']).default('ACES'),
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
        const { inputAsset = 'ACES', amount, slippageBps = '100' } = request.query;

        fastify.log.info(
          { tokenAddress, inputAsset, amount, slippageBps },
          '🔵 [MultiHopQuote] Request received',
        );

        // Validate inputs
        const amountNum = parseFloat(amount || '0');
        if (!isFinite(amountNum) || amountNum <= 0) {
          fastify.log.warn({ amount }, '❌ [MultiHopQuote] Invalid amount');
          return reply.code(400).send({
            success: false,
            error: 'Invalid amount',
          });
        }

        const slippage = parseInt(slippageBps);

        // 🔥 CACHE: Cache entire multi-hop quote result with request deduplication
        const normalizedToken = tokenAddress.toLowerCase();
        const cacheKey = `multihop-quote:${normalizedToken}:${inputAsset}:${amount}:${slippage}`;
        const CACHE_TTL = 3000; // 3 seconds - shorter than direct bonding due to pool price volatility

        // Track cache stats before to determine if this is a hit
        const statsBefore = fastify.cache.getStats();

        const quoteResult = await fastify.cache.getOrFetch<{
          success: boolean;
          data?: MultiHopQuoteResponse;
          error?: string;
        }>(
          'quotes',
          cacheKey,
          async () => {
            // Quote calculation logic (moved inside cache callback)
            return await calculateMultiHopQuote(
              fastify,
              tokenAddress,
              inputAsset,
              amount || '',
              slippage,
            );
          },
          CACHE_TTL,
        );

        // Determine if this was a cache hit
        const statsAfter = fastify.cache.getStats();
        const wasCached = statsAfter.hits > statsBefore.hits;

        if (!quoteResult.success) {
          // Check if it's a rate limit error
          const isRateLimit = isRateLimitError(quoteResult.error);
          return reply
            .code(
              quoteResult.error?.includes('Insufficient') ||
                quoteResult.error?.includes('not found')
                ? 400
                : isRateLimit
                  ? 429
                  : 500,
            )
            .send({
              success: false,
              error: quoteResult.error || 'Failed to calculate quote',
              cached: wasCached,
            });
        }

        return reply.send({
          success: true,
          data: quoteResult.data,
          cached: wasCached,
        });
      } catch (error) {
        // Check if it's a rate limit error
        const isRateLimit = isRateLimitError(error);
        fastify.log.error(
          { err: error, isRateLimit },
          '❌ [MultiHopQuote] Failed to compute multi-hop quote',
        );
        return reply.code(isRateLimit ? 429 : 500).send({
          success: false,
          error: isRateLimit
            ? getRateLimitErrorMessage(error)
            : error instanceof Error
              ? error.message
              : 'Failed to calculate quote',
          cached: false,
        });
      }
    },
  );

  // 🔥 Extract multi-hop quote calculation logic to separate function
  // This allows caching to wrap the entire calculation
  async function calculateMultiHopQuote(
    fastify: FastifyInstance,
    tokenAddress: string,
    inputAsset: string,
    amount: string,
    slippage: number,
  ): Promise<{ success: boolean; data?: MultiHopQuoteResponse; error?: string }> {
    try {
      // If input is ACES, no multi-hop needed
      if (inputAsset === 'ACES') {
        fastify.log.info('✅ [MultiHopQuote] Direct ACES input - no multi-hop needed');
        return {
          success: true,
          data: {
            inputAsset: 'ACES',
            inputAmount: amount,
            expectedAcesAmount: amount,
            expectedRwaOutput: '0',
            path: ['ACES', tokenAddress.toLowerCase()],
            needsMultiHop: false,
            slippageBps: slippage,
          } as MultiHopQuoteResponse,
        };
      }

      // Setup network and provider
      const networkConfig = getNetworkConfig(8453);
      const acesAddress = networkConfig.acesToken;
      const provider = getProvider(8453);

      if (!provider) {
        fastify.log.error('❌ [MultiHopQuote] RPC provider not available');
        return {
          success: false,
          error: 'RPC provider not available',
        };
      }

      fastify.log.info('✅ [MultiHopQuote] Provider initialized');

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

      // Helper function to read pool reserves directly (with caching)
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
        try {
          // 🔥 CACHE: Pool reserves change frequently but can be cached for 5-10 seconds
          const cacheKey = `pool-reserves:${poolAddress.toLowerCase()}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}`;
          const CACHE_TTL = 5000; // 5 seconds - balances change frequently

          const cached = fastify.cache.get<{
            poolAddress: string;
            reserveIn: bigint;
            reserveOut: bigint;
            decimalsIn: number;
            decimalsOut: number;
          }>('other', cacheKey);

          if (cached) {
            fastify.log.debug({ poolAddress }, '✅ [BondingQuote] Using cached pool reserves');
            return cached;
          }

          const PAIR_ABI = [
            'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
            'function token0() view returns (address)',
            'function token1() view returns (address)',
          ];

          fastify.log.info(
            { poolAddress, tokenIn, tokenOut },
            '🔍 [BondingQuote] Reading pool reserves from RPC',
          );

          const pairContract = new ethers.Contract(poolAddress, PAIR_ABI, provider);

          // 🔥 RATE LIMIT RETRY: Wrap RPC calls with retry logic
          const [reserve0, reserve1] = await retryRpcCall(() => pairContract.getReserves(), {
            maxRetries: 3,
            logger: fastify.log,
            operationName: `getReserves(${poolAddress})`,
          });

          const token0 = (await retryRpcCall(() => pairContract.token0(), {
            maxRetries: 3,
            logger: fastify.log,
            operationName: `token0(${poolAddress})`,
          })) as string;

          const token1 = (await retryRpcCall(() => pairContract.token1(), {
            maxRetries: 3,
            logger: fastify.log,
            operationName: `token1(${poolAddress})`,
          })) as string;

          const normalizedToken0 = token0.toLowerCase();
          const normalizedToken1 = token1.toLowerCase();

          fastify.log.info(
            {
              token0: normalizedToken0,
              token1: normalizedToken1,
              reserve0: reserve0.toString(),
              reserve1: reserve1.toString(),
            },
            '📊 [BondingQuote] Pool state',
          );

          const normalizedIn = tokenIn.toLowerCase();
          const normalizedOut = tokenOut.toLowerCase();

          let reserveIn: bigint;
          let reserveOut: bigint;

          if (normalizedToken0 === normalizedIn && normalizedToken1 === normalizedOut) {
            reserveIn = BigInt(reserve0.toString());
            reserveOut = BigInt(reserve1.toString());
          } else if (normalizedToken0 === normalizedOut && normalizedToken1 === normalizedIn) {
            reserveIn = BigInt(reserve1.toString());
            reserveOut = BigInt(reserve0.toString());
          } else {
            fastify.log.error(
              { token0: normalizedToken0, token1: normalizedToken1, normalizedIn, normalizedOut },
              '❌ [BondingQuote] Token mismatch in pool',
            );
            return null;
          }

          // 🔥 CACHE: Token decimals rarely change, cache for 5 minutes
          const decimalsCacheKeyIn = `token-decimals:${normalizedIn}`;
          const decimalsCacheKeyOut = `token-decimals:${normalizedOut}`;

          let decimalsIn: number;
          let decimalsOut: number;

          const cachedDecimalsIn = fastify.cache.get<number>('other', decimalsCacheKeyIn);
          const cachedDecimalsOut = fastify.cache.get<number>('other', decimalsCacheKeyOut);

          if (cachedDecimalsIn) {
            decimalsIn = cachedDecimalsIn;
          } else {
            const ERC20_ABI = ['function decimals() view returns (uint8)'];
            const tokenInContract = new ethers.Contract(normalizedIn, ERC20_ABI, provider);
            decimalsIn = Number(
              await retryRpcCall(() => tokenInContract.decimals(), {
                maxRetries: 3,
                logger: fastify.log,
                operationName: `decimals(${normalizedIn})`,
              }),
            );
            fastify.cache.set('other', decimalsCacheKeyIn, decimalsIn, 5 * 60 * 1000); // 5 min
          }

          if (cachedDecimalsOut) {
            decimalsOut = cachedDecimalsOut;
          } else {
            const ERC20_ABI = ['function decimals() view returns (uint8)'];
            const tokenOutContract = new ethers.Contract(normalizedOut, ERC20_ABI, provider);
            decimalsOut = Number(
              await retryRpcCall(() => tokenOutContract.decimals(), {
                maxRetries: 3,
                logger: fastify.log,
                operationName: `decimals(${normalizedOut})`,
              }),
            );
            fastify.cache.set('other', decimalsCacheKeyOut, decimalsOut, 5 * 60 * 1000); // 5 min
          }

          fastify.log.info(
            {
              reserveIn: reserveIn.toString(),
              reserveOut: reserveOut.toString(),
              decimalsIn,
              decimalsOut,
            },
            '✅ [BondingQuote] Pool reserves read successfully',
          );

          const result = {
            poolAddress,
            reserveIn,
            reserveOut,
            decimalsIn,
            decimalsOut,
          };

          // Cache the result
          fastify.cache.set('other', cacheKey, result, CACHE_TTL);

          return result;
        } catch (error) {
          // Check if it's a rate limit error
          if (isRateLimitError(error)) {
            fastify.log.error(
              { err: error, poolAddress },
              '❌ [BondingQuote] Rate limit error reading pool reserves',
            );
            // Return null to signal failure, but with a more specific error message
            // The error will be caught by the caller and handled appropriately
            throw new Error(getRateLimitErrorMessage(error));
          }

          fastify.log.error(
            { err: error, poolAddress },
            '❌ [BondingQuote] Failed to read pool reserves',
          );
          return null;
        }
      };

      const inputConfig = assetMetadata[inputAsset as keyof typeof assetMetadata];
      if (!inputConfig) {
        fastify.log.warn({ inputAsset }, '❌ [MultiHopQuote] Unsupported input asset');
        return {
          success: false,
          error: `Unsupported input asset: ${inputAsset}`,
        };
      }

      if (!amount) {
        return {
          success: false,
          error: 'Amount is required',
        };
      }

      let amountInRaw: bigint;
      try {
        amountInRaw = ethers.parseUnits(amount, inputConfig.decimals);
      } catch (error) {
        fastify.log.warn(
          { amount, decimals: inputConfig.decimals, err: error },
          '❌ [MultiHopQuote] Amount precision exceeds token decimals',
        );
        return {
          success: false,
          error: `Amount has more than ${inputConfig.decimals} decimal places`,
        };
      }

      // Parse amount for USD calculations
      const amountNum = parseFloat(amount || '0');

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
        let wethToAces;
        try {
          wethToAces = await getPoolReservesDirect(
            wethAcesPool,
            assetMetadata.WETH.address,
            assetMetadata.ACES.address,
          );
        } catch (error) {
          if (isRateLimitError(error)) {
            fastify.log.error(
              { err: error, poolAddress: wethAcesPool },
              '❌ [MultiHopQuote] Rate limit error reading WETH/ACES pool',
            );
            return {
              success: false,
              error: getRateLimitErrorMessage(error),
            };
          }
          throw error; // Re-throw non-rate-limit errors
        }

        if (!wethToAces) {
          fastify.log.error(
            { poolAddress: wethAcesPool },
            '❌ [MultiHopQuote] Failed to read WETH/ACES pool',
          );

          return {
            success: false,
            error: 'WETH/ACES pool not found or not readable.',
          };
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
        let stableToWeth;
        try {
          stableToWeth = await getPoolReservesDirect(
            usdcWethPool,
            inputConfig.address,
            assetMetadata.WETH.address,
          );
        } catch (error) {
          if (isRateLimitError(error)) {
            fastify.log.error(
              { err: error, poolAddress: usdcWethPool },
              '❌ [MultiHopQuote] Rate limit error reading USDC/WETH pool',
            );
            return {
              success: false,
              error: getRateLimitErrorMessage(error),
            };
          }
          throw error;
        }

        if (!stableToWeth) {
          fastify.log.error(
            { poolAddress: usdcWethPool },
            '❌ [MultiHopQuote] Failed to read USDC/WETH pool',
          );

          return {
            success: false,
            error: 'USDC/WETH pool not found or not readable.',
          };
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
        let wethToAces;
        try {
          wethToAces = await getPoolReservesDirect(
            wethAcesPool,
            assetMetadata.WETH.address,
            assetMetadata.ACES.address,
          );
        } catch (error) {
          if (isRateLimitError(error)) {
            fastify.log.error(
              { err: error, poolAddress: wethAcesPool },
              '❌ [MultiHopQuote] Rate limit error reading WETH/ACES pool',
            );
            return {
              success: false,
              error: getRateLimitErrorMessage(error),
            };
          }
          throw error;
        }

        if (!wethToAces) {
          fastify.log.error(
            { poolAddress: wethAcesPool },
            '❌ [MultiHopQuote] Failed to read WETH/ACES pool',
          );

          return {
            success: false,
            error: 'WETH/ACES pool not found or not readable.',
          };
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
        let stableToWeth;
        try {
          stableToWeth = await getPoolReservesDirect(
            usdcWethPool,
            assetMetadata.USDC.address, // Use USDC pool address
            assetMetadata.WETH.address,
          );
        } catch (error) {
          if (isRateLimitError(error)) {
            fastify.log.error(
              { err: error, poolAddress: usdcWethPool },
              '❌ [MultiHopQuote] Rate limit error reading USDC/WETH pool for USDT quote',
            );
            return {
              success: false,
              error: getRateLimitErrorMessage(error),
            };
          }
          throw error;
        }

        if (!stableToWeth) {
          fastify.log.error(
            { poolAddress: usdcWethPool },
            '❌ [MultiHopQuote] Failed to read USDC/WETH pool for USDT quote',
          );

          return {
            success: false,
            error: 'USDC/WETH pool not found or not readable.',
          };
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
        let wethToAces;
        try {
          wethToAces = await getPoolReservesDirect(
            wethAcesPool,
            assetMetadata.WETH.address,
            assetMetadata.ACES.address,
          );
        } catch (error) {
          if (isRateLimitError(error)) {
            fastify.log.error(
              { err: error, poolAddress: wethAcesPool },
              '❌ [MultiHopQuote] Rate limit error reading WETH/ACES pool',
            );
            return {
              success: false,
              error: getRateLimitErrorMessage(error),
            };
          }
          throw error;
        }

        if (!wethToAces) {
          fastify.log.error(
            { poolAddress: wethAcesPool },
            '❌ [MultiHopQuote] Failed to read WETH/ACES pool',
          );

          return {
            success: false,
            error: 'WETH/ACES pool not found or not readable.',
          };
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
        fastify.log.error('❌ [MultiHopQuote] Zero ACES output - insufficient liquidity');
        return {
          success: false,
          error: 'Insufficient liquidity for this trade size',
        };
      }

      // Apply slippage to ACES amount
      const minAcesAmountRaw = (acesAmountRaw * BigInt(10_000 - slippage)) / 10_000n;

      // Calculate final RWA token output using bonding curve
      fastify.log.info('🔄 [BondingQuote] Calculating ACES → RWA token output');

      const factoryProxyAddress = networkConfig.acesFactoryProxy;
      if (!factoryProxyAddress) {
        fastify.log.error('❌ [MultiHopQuote] Factory proxy not configured');
        return {
          success: false,
          error: 'Factory proxy not configured',
        };
      }

      const factoryContract = new ethers.Contract(factoryProxyAddress, FACTORY_ABI, provider);

      // Check if token is bonded - wrap with retry logic
      let tokenInfo;
      try {
        tokenInfo = await retryRpcCall(() => factoryContract.tokens(tokenAddress), {
          maxRetries: 3,
          logger: fastify.log,
          operationName: `factoryContract.tokens(${tokenAddress})`,
        });
      } catch (error) {
        if (isRateLimitError(error)) {
          fastify.log.error(
            { err: error, tokenAddress },
            '❌ [MultiHopQuote] Rate limit error reading token info',
          );
          return {
            success: false,
            error: getRateLimitErrorMessage(error),
          };
        }
        throw error;
      }

      if (tokenInfo.tokenBonded) {
        return {
          success: false,
          error: 'Token is fully bonded, use DEX mode',
        };
      }

      // Get token decimals (cached)
      const decimalsCacheKey = `token-decimals:${tokenAddress.toLowerCase()}`;
      let tokenDecimals: number;
      const cachedDecimals = fastify.cache.get<number>('other', decimalsCacheKey);
      if (cachedDecimals) {
        tokenDecimals = cachedDecimals;
      } else {
        const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
        try {
          tokenDecimals = Number(
            await retryRpcCall(() => tokenContract.decimals(), {
              maxRetries: 3,
              logger: fastify.log,
              operationName: `tokenContract.decimals(${tokenAddress})`,
            }),
          );
        } catch (error) {
          if (isRateLimitError(error)) {
            fastify.log.error(
              { err: error, tokenAddress },
              '❌ [MultiHopQuote] Rate limit error reading token decimals',
            );
            return {
              success: false,
              error: getRateLimitErrorMessage(error),
            };
          }
          throw error;
        }
        fastify.cache.set('other', decimalsCacheKey, tokenDecimals, 5 * 60 * 1000); // 5 min
      }

      // 🔥 FORMULA-BASED CALCULATION: Use formula instead of binary search with RPC calls
      fastify.log.info('🔄 [MultiHopQuote] Calculating ACES → RWA token output via formula');

      // Get fee percentages (cached)
      const feePercentages = await getFactoryFeePercentages(fastify, factoryContract);

      // Get token params (steepness, floor) - try unifiedGoldSkyService first
      let tokenParams: { steepness: bigint; floor: bigint } | null = null;
      const unifiedData = await (
        fastify as {
          unifiedGoldSkyService: {
            getUnifiedTokenData: (address: string) => Promise<UnifiedTokenData | null>;
          };
        }
      ).unifiedGoldSkyService?.getUnifiedTokenData(tokenAddress);

      if (unifiedData?.steepness && unifiedData?.floor) {
        tokenParams = {
          steepness: BigInt(unifiedData.steepness),
          floor: BigInt(unifiedData.floor),
        };
      } else {
        // Fallback to contract
        tokenParams = {
          steepness: tokenInfo.steepness,
          floor: tokenInfo.floor,
        };
      }

      // Get current supply
      let currentSupply: bigint;
      if (unifiedData?.trades && unifiedData.trades.length > 0) {
        const latestTrade = unifiedData.trades[0];
        const supplyInTokens = BigInt(Math.floor(parseFloat(latestTrade.supply)));
        currentSupply = supplyInTokens * BigInt(10) ** BigInt(tokenDecimals);
      } else {
        const supplyCacheKey = `token-supply:${tokenAddress.toLowerCase()}`;
        const cachedSupply = fastify.cache.get<bigint>('other', supplyCacheKey);
        if (cachedSupply) {
          currentSupply = cachedSupply;
        } else {
          const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
          try {
            currentSupply = await retryRpcCall(() => tokenContract.totalSupply(), {
              maxRetries: 3,
              logger: fastify.log,
              operationName: `tokenContract.totalSupply(${tokenAddress})`,
            });
          } catch (error) {
            if (isRateLimitError(error)) {
              fastify.log.error(
                { err: error, tokenAddress },
                '❌ [MultiHopQuote] Rate limit error reading token supply',
              );
              return {
                success: false,
                error: getRateLimitErrorMessage(error),
              };
            }
            throw error;
          }
          fastify.cache.set('other', supplyCacheKey, currentSupply, 2000); // 2s TTL
        }
      }

      // Get max supply
      const oneToken = ethers.parseUnits('1', tokenDecimals);
      const W = BigInt(10) ** BigInt(18);
      let launchpadMaxSupply = BigInt(10) ** BigInt(9) * W; // Default 1B tokens
      try {
        const tokenContractWithMaxSupply = new ethers.Contract(
          tokenAddress,
          [...TOKEN_ABI, 'function MAX_TOTAL_SUPPLY() view returns (uint256)'],
          provider,
        );
        launchpadMaxSupply = await tokenContractWithMaxSupply.MAX_TOTAL_SUPPLY();
      } catch {
        // Use default
      }

      // Build quote state for formula
      const quoteState: QuoteState = {
        supply: (currentSupply / BigInt(10) ** BigInt(tokenDecimals)) * BigInt(10) ** BigInt(18), // Convert to 18 decimals
        steepness: tokenParams.steepness,
        floor: tokenParams.floor,
        protocolFeePercent: feePercentages.protocolFeePercent,
        subjectFeePercent: feePercentages.subjectFeePercent,
        tokenBonded: tokenInfo.tokenBonded,
        tokensBondedAt: tokenInfo.tokensBondedAt || 0n,
        launchpadMaxSupply: launchpadMaxSupply / BigInt(10) ** BigInt(18 - tokenDecimals), // Convert to token decimals
      };

      // Use formula-based binary search (no RPC calls!)
      const tokenAmountWei = quoteBuyAmountFromAces(acesAmountRaw, quoteState);
      const expectedRwaOutput = ethers.formatUnits(tokenAmountWei, tokenDecimals);

      fastify.log.info(
        {
          acesAmount: ethers.formatUnits(acesAmountRaw, 18),
          rwaTokens: expectedRwaOutput,
        },
        '✅ [MultiHopQuote] ACES → RWA calculation complete (formula-based, zero RPC calls)',
      );

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
        inputAsset: inputAsset as 'ACES' | 'WETH' | 'USDC' | 'USDT',
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
        '✅ [MultiHopQuote] Final response',
      );

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      fastify.log.error({ err: error }, '❌ [MultiHopQuote] Failed to compute multi-hop quote');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate quote',
      };
    }
  }
}
