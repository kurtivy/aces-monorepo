import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ethers } from 'ethers';
import { getNetworkConfig, createProvider } from '../../config/network.config';
import { AerodromeDataService } from '../../services/aerodrome-data-service';

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

interface MultiHopQuoteParams {
  tokenAddress: string;
}

interface MultiHopQuoteQuery {
  inputAsset?: string;
  amount?: string;
  slippageBps?: string;
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
}

/**
 * Bonding curve multi-hop quote routes
 * Calculates intermediate ACES amounts for USDC/USDT/WETH → ACES → RWA swaps
 */
export async function bondingRoutes(fastify: FastifyInstance) {
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

        // If input is ACES, no multi-hop needed
        if (inputAsset === 'ACES') {
          fastify.log.info('✅ [BondingQuote] Direct ACES input - no multi-hop needed');
          return reply.send({
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

        // Helper function to read pool reserves directly
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
            const PAIR_ABI = [
              'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
              'function token0() view returns (address)',
              'function token1() view returns (address)',
            ];

            fastify.log.info(
              { poolAddress, tokenIn, tokenOut },
              '🔍 [BondingQuote] Reading pool reserves',
            );

            const pairContract = new ethers.Contract(poolAddress, PAIR_ABI, provider);
            const [reserve0, reserve1] = await pairContract.getReserves();
            const token0 = ((await pairContract.token0()) as string).toLowerCase();
            const token1 = ((await pairContract.token1()) as string).toLowerCase();

            fastify.log.info(
              {
                token0,
                token1,
                reserve0: reserve0.toString(),
                reserve1: reserve1.toString(),
              },
              '📊 [BondingQuote] Pool state',
            );

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
              fastify.log.error(
                { token0, token1, normalizedIn, normalizedOut },
                '❌ [BondingQuote] Token mismatch in pool',
              );
              return null;
            }

            // Get decimals
            const ERC20_ABI = ['function decimals() view returns (uint8)'];
            const tokenInContract = new ethers.Contract(normalizedIn, ERC20_ABI, provider);
            const tokenOutContract = new ethers.Contract(normalizedOut, ERC20_ABI, provider);
            const decimalsIn = Number(await tokenInContract.decimals());
            const decimalsOut = Number(await tokenOutContract.decimals());

            fastify.log.info(
              {
                reserveIn: reserveIn.toString(),
                reserveOut: reserveOut.toString(),
                decimalsIn,
                decimalsOut,
              },
              '✅ [BondingQuote] Pool reserves read successfully',
            );

            return {
              poolAddress,
              reserveIn,
              reserveOut,
              decimalsIn,
              decimalsOut,
            };
          } catch (error) {
            fastify.log.error(
              { err: error, poolAddress },
              '❌ [BondingQuote] Failed to read pool reserves',
            );
            return null;
          }
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

        const amountInRaw = ethers.parseUnits(amount, inputConfig.decimals);
        fastify.log.info(
          {
            symbol: inputConfig.symbol,
            address: inputConfig.address,
            decimals: inputConfig.decimals,
            amountInRaw: amountInRaw.toString(),
          },
          '💰 [BondingQuote] Input configuration',
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

          acesAmountRaw = computeSwap(amountInRaw, wethToAces.reserveIn, wethToAces.reserveOut);
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
            amountInRaw,
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
          fastify.log.info('🔄 [BondingQuote] Computing USDT → USDC → WETH → ACES');

          // Initialize Aerodrome service for dynamic pool discovery
          const aerodromeService = new AerodromeDataService({
            provider,
            acesTokenAddress: acesAddress,
            factoryAddress:
              process.env.AERODROME_FACTORY_ADDRESS || '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
            mockEnabled: false,
          });

          // Step 1: USDT → USDC
          fastify.log.info('🔍 [BondingQuote] Step 1: USDT → USDC (via Aerodrome)');

          const usdtToUsdcReserves = await aerodromeService.getPairReserves(
            inputConfig.address,
            assetMetadata.USDC.address,
          );

          if (!usdtToUsdcReserves) {
            fastify.log.error('❌ [BondingQuote] Failed to find USDT/USDC pool via Aerodrome');

            return reply.code(404).send({
              success: false,
              error: 'USDT/USDC pool not found. This route may not be available.',
            });
          }

          const usdcAmountRaw = computeSwap(
            amountInRaw,
            usdtToUsdcReserves.reserveIn,
            usdtToUsdcReserves.reserveOut,
          );

          intermediateSteps.push({
            symbol: 'USDC',
            amount: ethers.formatUnits(usdcAmountRaw, assetMetadata.USDC.decimals),
          });

          fastify.log.info(
            {
              input: `${amount} USDT`,
              output: `${ethers.formatUnits(usdcAmountRaw, 6)} USDC`,
            },
            '✅ [BondingQuote] USDT → USDC',
          );

          // Step 2: USDC → WETH
          fastify.log.info('🔍 [BondingQuote] Step 2: USDC → WETH');

          const usdcWethPool = knownPools['USDC-WETH'];
          const usdcToWeth = await getPoolReservesDirect(
            usdcWethPool,
            assetMetadata.USDC.address,
            assetMetadata.WETH.address,
          );

          if (!usdcToWeth) {
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
            usdcAmountRaw,
            usdcToWeth.reserveIn,
            usdcToWeth.reserveOut,
          );

          intermediateSteps.push({
            symbol: 'WETH',
            amount: ethers.formatUnits(wethAmountRaw, assetMetadata.WETH.decimals),
          });

          fastify.log.info(
            {
              input: `${ethers.formatUnits(usdcAmountRaw, 6)} USDC`,
              output: `${ethers.formatUnits(wethAmountRaw, 18)} WETH`,
            },
            '✅ [BondingQuote] USDC → WETH',
          );

          // Step 3: WETH → ACES
          fastify.log.info('🔍 [BondingQuote] Step 3: WETH → ACES');

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
            assetMetadata.USDC.address, // USDC
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

        const response: MultiHopQuoteResponse = {
          inputAsset: inputAsset as 'ACES' | 'WETH' | 'USDC' | 'USDT',
          inputAmount: amount,
          inputAmountRaw: amountInRaw.toString(),
          expectedAcesAmount: ethers.formatUnits(acesAmountRaw, 18),
          expectedAcesAmountRaw: acesAmountRaw.toString(),
          minAcesAmount: ethers.formatUnits(minAcesAmountRaw, 18),
          minAcesAmountRaw: minAcesAmountRaw.toString(),
          expectedRwaOutput: '0',
          path: routePath,
          intermediate: intermediateSteps.length ? intermediateSteps : undefined,
          slippageBps: slippage,
          needsMultiHop: true,
        };

        fastify.log.info(
          {
            inputAsset: response.inputAsset,
            inputAmount: response.inputAmount,
            expectedAcesAmount: response.expectedAcesAmount,
            minAcesAmount: response.minAcesAmount,
            path: response.path,
            intermediateSteps: response.intermediate,
          },
          '✅ [BondingQuote] Final response',
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
