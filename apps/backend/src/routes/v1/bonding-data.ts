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
}

// Simplified ABI - only what we need
const FACTORY_ABI = [
  'function tokens(address) view returns (uint8 curve, address tokenAddress, uint256 floor, uint256 steepness, uint256 acesTokenBalance, address subjectFeeDestination, uint256 tokensBondedAt, bool tokenBonded)',
];

const TOKEN_ABI = ['function totalSupply() view returns (uint256)'];

// Simple in-memory cache with 10s TTL
const cache = new Map<string, { data: BondingDataResponse; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds

/**
 * Bonding curve data endpoint
 * Returns comprehensive bonding curve state for a given token
 */
export async function bondingDataRoutes(fastify: FastifyInstance) {
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
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          fastify.log.info({ tokenAddress, chainId }, '✅ [BondingData] Cache hit');
          return reply.send({
            success: true,
            data: cached.data,
            cached: true,
          });
        }

        fastify.log.info({ tokenAddress, chainId }, '🔵 [BondingData] Fetching from RPC');

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
        const tokensBondedAt = ethers.formatEther(tokenData.tokensBondedAt);
        const acesBalance = ethers.formatEther(tokenData.acesTokenBalance);
        const floorWei = tokenData.floor.toString();
        const floorPriceACES = ethers.formatEther(tokenData.floor);
        const steepness = tokenData.steepness.toString();
        const isBonded = Boolean(tokenData.tokenBonded);

        // Calculate bonding percentage
        const currentSupplyNum = parseFloat(currentSupply);
        const tokensBondedAtNum = parseFloat(tokensBondedAt);
        const bondingPercentage = isBonded
          ? 100
          : tokensBondedAtNum > 0
            ? Math.min(100, (currentSupplyNum / tokensBondedAtNum) * 100)
            : 0;

        if (tokensBondedAtNum === 0) {
          fastify.log.warn({ tokenAddress, chainId }, '⚠️ [BondingData] tokensBondedAt is zero');
        }

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
}
