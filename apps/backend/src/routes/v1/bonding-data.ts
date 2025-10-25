import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ethers } from 'ethers';
import { getNetworkConfig, createProvider, SupportedChainId } from '../../config/network.config';

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

interface BondingDataParams {
  tokenAddress: string;
}

interface BondingDataQuery {
  chainId?: string;
}

type BondingTargetSource =
  | 'contract'
  | 'max_total_supply'
  | 'subgraph'
  | 'listing_parameters'
  | 'default';

interface BondingDataResponse {
  curve: number;
  currentSupply: string;
  tokensBondedAt: string;
  acesBalance: string;
  floorWei: string;
  floorPriceACES: string;
  steepness: string;
  isBonded: boolean;
  bondingPercentage: number;
  chainId: number;
  lastUpdated: number;
  bondingTargetSource: BondingTargetSource;
}

// Simplified ABI - only what we need
const FACTORY_ABI = [
  'function tokens(address) view returns (uint8 curve, address tokenAddress, uint256 floor, uint256 steepness, uint256 acesTokenBalance, address subjectFeeDestination, uint256 tokensBondedAt, bool tokenBonded)',
];

const TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function MAX_TOTAL_SUPPLY() view returns (uint256)',
  'function maxTotalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
];

// Simple in-memory cache with adaptive TTL
const cache = new Map<string, { data: BondingDataResponse; timestamp: number }>();
// 🔥 OPTIMIZED: Short cache for local dev (5s), longer for production (60s with webhook invalidation)
const CACHE_TTL = process.env.NODE_ENV === 'production' ? 60000 : 5000;

/**
 * Clear cache for a specific token or all tokens
 * @param tokenAddress - Optional token address to clear. If not provided, clears all cache.
 * @param chainId - Optional chain ID. If not provided with tokenAddress, clears all cache.
 * @returns Number of entries cleared
 */
export function clearBondingDataCache(tokenAddress?: string, chainId?: number): number {
  if (!tokenAddress) {
    const size = cache.size;
    cache.clear();
    return size;
  }

  const cacheKey = chainId
    ? `${tokenAddress.toLowerCase()}-${chainId}`
    : tokenAddress.toLowerCase();

  // If chainId not specified, clear all entries for this token across all chains
  if (!chainId) {
    let cleared = 0;
    for (const key of cache.keys()) {
      if (key.startsWith(cacheKey)) {
        cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  // Clear specific entry
  const deleted = cache.delete(cacheKey);
  return deleted ? 1 : 0;
}

/**
 * Bonding curve data endpoint
 * Returns comprehensive bonding curve state for a given token
 */
export async function bondingDataRoutes(fastify: FastifyInstance) {
  const fetchBondingTargetFromSubgraph = async (tokenAddress: string): Promise<string | null> => {
    const subgraphUrl = process.env.GOLDSKY_SUBGRAPH_URL;
    if (!subgraphUrl) {
      return null;
    }

    try {
      const query = `{
        tokens(where: {address: "${tokenAddress.toLowerCase()}"}) {
          tokensBondedAt
        }
      }`;

      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        fastify.log.warn(
          { tokenAddress, status: response.status },
          '[BondingData] Subgraph fallback request failed',
        );
        return null;
      }

      const payload = (await response.json()) as any;
      const subgraphTarget = payload?.data?.tokens?.[0]?.tokensBondedAt;

      if (subgraphTarget && Number.parseFloat(subgraphTarget) > 0) {
        return subgraphTarget;
      }

      return null;
    } catch (error) {
      fastify.log.warn(
        { tokenAddress, err: error instanceof Error ? error.message : String(error) },
        '[BondingData] Subgraph fallback threw error',
      );
      return null;
    }
  };

  const fetchBondingTargetFromListing = async (tokenAddress: string): Promise<string | null> => {
    if (!('prisma' in fastify) || !fastify.prisma) {
      return null;
    }

    try {
      const listing = await fastify.prisma.listing.findFirst({
        where: {
          token: {
            is: {
              contractAddress: tokenAddress.toLowerCase(),
            },
          },
        },
        select: {
          tokenParameters: true,
        },
      });

      const tokenParameters = listing?.tokenParameters as
        | {
            tokensBondedAt?: string | number;
            maxSupply?: string | number;
            totalSupply?: string | number;
          }
        | undefined;

      const fallback =
        tokenParameters?.tokensBondedAt ??
        tokenParameters?.maxSupply ??
        tokenParameters?.['totalSupply'];

      if (!fallback) {
        return null;
      }

      const parsed = Number.parseFloat(fallback.toString());
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
      }

      return parsed.toString();
    } catch (error) {
      fastify.log.warn(
        { tokenAddress, err: error instanceof Error ? error.message : String(error) },
        '[BondingData] Listing fallback failed',
      );
      return null;
    }
  };

  const resolveFallbackBondingTarget = async (
    tokenAddress: string,
    tokenContract: ethers.Contract,
  ): Promise<{ value: string; source: BondingTargetSource } | null> => {
    // 1. Try listing token parameters (admin-configured value is the most reliable)
    const listingTarget = await fetchBondingTargetFromListing(tokenAddress);
    if (listingTarget) {
      return { value: listingTarget, source: 'listing_parameters' };
    }

    // 2. Try subgraph data
    const subgraphTarget = await fetchBondingTargetFromSubgraph(tokenAddress);
    if (subgraphTarget) {
      return { value: subgraphTarget, source: 'subgraph' };
    }

    // 3. Try contract MAX_TOTAL_SUPPLY style functions
    const maxSupplyFns = ['MAX_TOTAL_SUPPLY', 'maxTotalSupply', 'maxSupply'] as const;
    const contractAny = tokenContract as any;
    for (const fn of maxSupplyFns) {
      try {
        if (typeof contractAny[fn] !== 'function') {
          continue;
        }
        const result = await contractAny[fn]();
        const parsed = Number.parseFloat(ethers.formatEther(result));
        if (Number.isFinite(parsed) && parsed > 0) {
          return { value: parsed.toString(), source: 'max_total_supply' };
        }
      } catch (error) {
        // Ignore missing function errors
        const message = error instanceof Error ? error.message : String(error);
        if (!/does not exist|missing revert data|execution reverted/i.test(message)) {
          fastify.log.debug(
            { tokenAddress, fn, err: message },
            '[BondingData] MAX_TOTAL_SUPPLY call failed',
          );
        }
      }
    }

    return null;
  };

  fastify.get(
    '/:tokenAddress/data',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            tokenAddress: addressSchema,
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            chainId: z.string().optional(),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: BondingDataParams;
        Querystring: BondingDataQuery;
      }>,
      reply,
    ) => {
      try {
        const { tokenAddress } = request.params;
        const { chainId: chainIdStr } = request.query;

        // Validate and parse chainId
        const chainId = chainIdStr ? parseInt(chainIdStr) : 8453; // Default to Base Mainnet
        if (chainId !== 8453 && chainId !== 84532) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid chainId. Must be 8453 (Base Mainnet) or 84532 (Base Sepolia)',
          });
        }

        // Check cache
        const cacheKey = `${tokenAddress.toLowerCase()}-${chainId}`;
        const cached = cache.get(cacheKey);
        const cacheAge = cached ? Math.floor((Date.now() - cached.timestamp) / 1000) : null;
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          fastify.log.info({ tokenAddress, chainId, cacheAge, ttl: CACHE_TTL / 1000 }, '✅ [BondingData] Cache hit');
          console.log(`[BondingData] 🎯 Cache hit for ${tokenAddress} (age: ${cacheAge}s, TTL: ${CACHE_TTL / 1000}s)`);
          return reply.send({
            success: true,
            data: cached.data,
            cached: true,
          });
        }

        fastify.log.info({ tokenAddress, chainId, cacheAge, expired: cacheAge ? cacheAge > CACHE_TTL / 1000 : 'no cache' }, '🔵 [BondingData] Fetching from RPC');
        console.log(`[BondingData] 🔍 Cache ${cacheAge ? `expired (age: ${cacheAge}s)` : 'miss'} - Fetching fresh data`);

        // Get network config and provider
        const networkConfig = getNetworkConfig(chainId as SupportedChainId);
        const provider = createProvider(chainId as SupportedChainId);

        if (!provider) {
          fastify.log.error({ chainId }, '❌ [BondingData] RPC provider not available');
          return reply.code(500).send({
            success: false,
            error: 'RPC provider not available',
          });
        }

        // Get factory proxy address from network config
        const factoryProxyAddress = networkConfig.acesFactoryProxy;

        if (!factoryProxyAddress) {
          fastify.log.error({ chainId }, '❌ [BondingData] Factory proxy not configured');
          return reply.code(500).send({
            success: false,
            error: 'Factory proxy not configured for this chain',
          });
        }

        // Initialize contracts
        const factoryContract = new ethers.Contract(factoryProxyAddress, FACTORY_ABI, provider);
        const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);

        // Fetch bonding data in parallel
        const [tokenData, totalSupply] = await Promise.all([
          factoryContract.tokens(tokenAddress),
          tokenContract.totalSupply(),
        ]);

        // Parse contract data
        const curve = Number(tokenData.curve);
        const currentSupply = ethers.formatEther(totalSupply);
        let tokensBondedAt = ethers.formatEther(tokenData.tokensBondedAt);
        const acesBalance = ethers.formatEther(tokenData.acesTokenBalance);
        const floorWei = tokenData.floor.toString();
        const floorPriceACES = ethers.formatEther(tokenData.floor);
        const steepness = tokenData.steepness.toString();
        const isBonded = Boolean(tokenData.tokenBonded);

        // Calculate bonding percentage
        const currentSupplyNum = parseFloat(currentSupply);
        let tokensBondedAtNum = parseFloat(tokensBondedAt);
        let bondingTargetSource: BondingTargetSource = 'contract';

        if (!isBonded && (tokensBondedAtNum <= 0 || Number.isNaN(tokensBondedAtNum))) {
          fastify.log.warn({ tokenAddress, chainId }, '⚠️ [BondingData] tokensBondedAt is zero');
          const fallback = await resolveFallbackBondingTarget(tokenAddress, tokenContract);
          if (fallback) {
            tokensBondedAt = fallback.value;
            tokensBondedAtNum = parseFloat(tokensBondedAt);
            bondingTargetSource = fallback.source;
            fastify.log.info(
              { tokenAddress, chainId, source: fallback.source, tokensBondedAt: fallback.value },
              '[BondingData] Applied fallback bonding target',
            );
          } else {
            bondingTargetSource = 'default';
            tokensBondedAt = '30000000';
            tokensBondedAtNum = 30000000;
            fastify.log.warn(
              { tokenAddress, chainId },
              '⚠️ [BondingData] Using default bonding target fallback',
            );
          }
        }

        const bondingPercentage = isBonded
          ? 100
          : tokensBondedAtNum > 0
            ? Math.min(100, (currentSupplyNum / tokensBondedAtNum) * 100)
            : 0;

        const responseData: BondingDataResponse = {
          curve,
          currentSupply,
          tokensBondedAt,
          acesBalance,
          floorWei,
          floorPriceACES,
          steepness,
          isBonded,
          bondingPercentage,
          chainId,
          lastUpdated: Date.now(),
          bondingTargetSource,
        };

        // Cache the result
        cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

        fastify.log.info(
          { tokenAddress, chainId, bondingPercentage },
          '✅ [BondingData] Successfully fetched',
        );

        return reply.send({
          success: true,
          data: responseData,
          cached: false,
        });
      } catch (error) {
        fastify.log.error({ err: error }, '❌ [BondingData] Failed to fetch bonding data');
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch bonding data',
        });
      }
    },
  );

  /**
   * Cache invalidation endpoint for debugging
   * DELETE /api/v1/bonding/:tokenAddress/cache
   * Query params:
   * - chainId: Optional chain ID (8453 or 84532)
   * - all: If true, clears entire cache
   */
  fastify.delete(
    '/:tokenAddress/cache',
    {
      schema: {
        params: zodToJsonSchema(
          z.object({
            tokenAddress: addressSchema.or(z.literal('all')),
          }),
        ),
        querystring: zodToJsonSchema(
          z.object({
            chainId: z.string().optional(),
          }),
        ),
      },
    },
    async (
      request: FastifyRequest<{
        Params: { tokenAddress: string };
        Querystring: { chainId?: string };
      }>,
      reply,
    ) => {
      try {
        const { tokenAddress } = request.params;
        const { chainId: chainIdStr } = request.query;

        let cleared = 0;

        if (tokenAddress.toLowerCase() === 'all') {
          // Clear entire cache
          cleared = clearBondingDataCache();
          fastify.log.info('🧹 [BondingData] Cleared entire cache');
        } else {
          // Clear specific token
          const chainId = chainIdStr ? parseInt(chainIdStr) : undefined;
          cleared = clearBondingDataCache(tokenAddress, chainId);
          fastify.log.info(
            { tokenAddress, chainId, cleared },
            '🧹 [BondingData] Cleared token cache',
          );
        }

        return reply.send({
          success: true,
          cleared,
          message: `Cleared ${cleared} cache ${cleared === 1 ? 'entry' : 'entries'}`,
        });
      } catch (error) {
        fastify.log.error({ err: error }, '❌ [BondingData] Failed to clear cache');
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear cache',
        });
      }
    },
  );
}
