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

        // SUPER LOUD LOG - YOU SHOULD SEE THIS
        console.log('='.repeat(80));
        console.log('🔵🔵🔵 DIRECT BONDING QUOTE REQUEST RECEIVED 🔵🔵🔵');
        console.log('Token:', tokenAddress);
        console.log('Amount:', amount);
        console.log('InputAsset:', inputAsset);
        console.log('Slippage:', slippageBps);
        console.log('='.repeat(80));

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

        // Setup network and provider
        const networkConfig = getNetworkConfig(8453);
        const acesAddress = networkConfig.acesToken;
        const factoryProxyAddress = networkConfig.acesFactoryProxy;
        const provider = createProvider(8453);

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

        // Check if token is bonded first
        const tokenInfo = await factoryContract.tokens(tokenAddress);

        if (tokenInfo.tokenBonded) {
          return reply.code(400).send({
            success: false,
            error: 'Token is fully bonded, use DEX mode',
          });
        }

        if (inputAsset === 'ACES') {
          // ACES → TOKEN (buy)
          // User enters ACES amount, we calculate how many tokens they get
          // We need to do binary search to find the token amount that costs <= ACES input
          const acesInputWei = ethers.parseUnits(amount, 18); // ACES is 18 decimals

          // Apply slippage to input ACES (reduce input to ensure success even if price moves)
          // This protects users who input their max balance
          const acesInputWithSlippage = (acesInputWei * BigInt(10000 - slippage)) / BigInt(10000);

          fastify.log.info(
            {
              acesInputWei: acesInputWei.toString(),
              acesInputWithSlippage: acesInputWithSlippage.toString(),
              amount,
              slippage,
            },
            '🔄 [DirectBondingQuote] Calculating ACES → TOKEN via binary search with slippage',
          );

          // Binary search for the maximum token amount we can buy with the given ACES (after slippage)
          const oneToken = ethers.parseUnits('1', tokenDecimals);
          let left = oneToken;
          let right = ethers.parseUnits('1000000', tokenDecimals); // Max tokens to search
          let bestTokenAmount = 0n;

          // Check if we can even afford 1 token
          try {
            const costForOne = await factoryContract.getBuyPriceAfterFee(tokenAddress, oneToken);

            console.log('💰 COST CHECK FOR 1 TOKEN:');
            console.log('  Cost for 1 token:', ethers.formatEther(costForOne), 'ACES');
            console.log(
              '  ACES after slippage:',
              ethers.formatEther(acesInputWithSlippage),
              'ACES',
            );
            console.log('  Original ACES input:', amount);
            console.log('  Can afford?', costForOne <= acesInputWithSlippage);

            fastify.log.info(
              {
                costForOne: ethers.formatEther(costForOne),
                acesInputWithSlippage: ethers.formatEther(acesInputWithSlippage),
                originalAces: amount,
                canAfford: costForOne <= acesInputWithSlippage,
              },
              '💰 [DirectBondingQuote] Cost check for 1 token',
            );

            if (costForOne > acesInputWithSlippage) {
              return reply.code(400).send({
                success: false,
                error: `Insufficient ACES. Need at least ${ethers.formatEther(costForOne)} ACES to buy 1 token (after ${slippage / 100}% slippage)`,
              });
            }
          } catch (error) {
            fastify.log.error({ err: error }, '❌ Failed to get price for 1 token');
            throw error;
          }

          // Binary search
          let iterations = 0;
          console.log('🔎 STARTING BINARY SEARCH:');
          console.log('  Initial left:', ethers.formatUnits(left, tokenDecimals));
          console.log('  Initial right:', ethers.formatUnits(right, tokenDecimals));

          while (left <= right && iterations < 50) {
            iterations++;
            // Calculate midpoint and round down to nearest whole token
            const midRaw = (left + right) / 2n;
            const mid = (midRaw / oneToken) * oneToken; // Ensure it's a multiple of oneToken

            try {
              const acesCost = await factoryContract.getBuyPriceAfterFee(tokenAddress, mid);

              if (iterations <= 3 || iterations === 19) {
                console.log(`  Iteration ${iterations}:`);
                console.log(`    Mid: ${ethers.formatUnits(mid, tokenDecimals)} tokens`);
                console.log(`    Cost: ${ethers.formatEther(acesCost)} ACES`);
                console.log(`    Available: ${ethers.formatEther(acesInputWithSlippage)} ACES`);
                console.log(`    Can afford: ${acesCost <= acesInputWithSlippage}`);
              }

              if (acesCost <= acesInputWithSlippage) {
                // Can afford this amount, try larger
                bestTokenAmount = mid;
                left = mid + oneToken;
                if (iterations <= 3)
                  console.log(
                    `    ✅ Can afford! Trying larger (new left: ${ethers.formatUnits(left, tokenDecimals)})`,
                  );
              } else {
                // Too expensive, try smaller
                right = mid - oneToken;
                if (iterations <= 3)
                  console.log(
                    `    ❌ Too expensive! Trying smaller (new right: ${ethers.formatUnits(right, tokenDecimals)})`,
                  );
              }
            } catch (error) {
              console.log(
                `  ❌ Iteration ${iterations} ERROR at ${ethers.formatUnits(mid, tokenDecimals)} tokens:`,
              );
              console.log(`    Error:`, error instanceof Error ? error.message : String(error));

              fastify.log.warn(
                { err: error, mid: ethers.formatUnits(mid, tokenDecimals) },
                '⚠️ [DirectBondingQuote] Binary search error at mid',
              );
              // If we hit an error, the amount might be too large
              right = mid - oneToken;
            }
          }

          console.log('🔍 BINARY SEARCH COMPLETED:');
          console.log('  Best token amount:', ethers.formatUnits(bestTokenAmount, tokenDecimals));
          console.log('  Iterations:', iterations);
          console.log('  ACES input:', amount);
          console.log('  ACES after slippage:', ethers.formatEther(acesInputWithSlippage));

          fastify.log.info(
            {
              bestTokenAmount: ethers.formatUnits(bestTokenAmount, tokenDecimals),
              iterations,
              acesInput: amount,
              acesAfterSlippage: ethers.formatEther(acesInputWithSlippage),
            },
            '🔍 [DirectBondingQuote] Binary search completed',
          );

          if (bestTokenAmount === 0n) {
            console.log('❌ ERROR: bestTokenAmount is 0! Returning error to frontend.');
            return reply.code(400).send({
              success: false,
              error: `Unable to calculate token amount. Your ${amount} ACES (${ethers.formatEther(acesInputWithSlippage)} after ${slippage / 100}% slippage) may not be enough.`,
            });
          }

          expectedOutput = ethers.formatUnits(bestTokenAmount, tokenDecimals);
          outputAsset = tokenAddress;

          fastify.log.info(
            { input: `${amount} ACES`, output: `${expectedOutput} TOKEN` },
            '✅ [DirectBondingQuote] ACES → TOKEN calculated',
          );
        } else {
          // TOKEN → ACES (sell)
          const amountWei = ethers.parseUnits(amount, tokenDecimals);

          fastify.log.info(
            { amountWei: amountWei.toString(), amount, tokenDecimals },
            '🔄 [DirectBondingQuote] Calculating TOKEN → ACES',
          );

          const acesWei = await factoryContract.getSellPriceAfterFee(tokenAddress, amountWei);
          expectedOutput = ethers.formatEther(acesWei);
          outputAsset = acesAddress;

          fastify.log.info(
            { input: `${amount} TOKEN`, output: `${expectedOutput} ACES` },
            '✅ [DirectBondingQuote] TOKEN → ACES calculated',
          );
        }

        // Get ACES USD price for USD value calculation
        let inputUsdValue: string | null = null;
        let outputUsdValue: string | null = null;

        try {
          const acesUsdResponse = await fetch(
            `${process.env.API_BASE_URL || 'http://localhost:3002'}/api/v1/prices/aces-usd`,
          );
          if (acesUsdResponse.ok) {
            const acesUsdData = (await acesUsdResponse.json()) as {
              data?: { acesUsdPrice?: number };
              price?: number;
            };
            const acesUsd = parseFloat(
              String(acesUsdData?.data?.acesUsdPrice ?? acesUsdData?.price ?? '0'),
            );

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
          }
        } catch (error) {
          fastify.log.warn('⚠️ [DirectBondingQuote] Failed to fetch ACES USD price');
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
            amountInWithSlippage,
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

        const factoryContract = new ethers.Contract(factoryProxyAddress, FACTORY_ABI, provider);

        // Check if token is bonded
        const tokenInfo = await factoryContract.tokens(tokenAddress);
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

        // Binary search to find max RWA tokens we can buy with the ACES amount
        const oneToken = ethers.parseUnits('1', tokenDecimals);
        let left = oneToken;
        let right = ethers.parseUnits('1000000', tokenDecimals);
        let bestTokenAmount = 0n;

        try {
          // Check if we can afford 1 token
          const costForOne = await factoryContract.getBuyPriceAfterFee(tokenAddress, oneToken);
          if (costForOne > acesAmountRaw) {
            expectedRwaOutput = '0';
            fastify.log.warn(
              {
                costForOne: ethers.formatEther(costForOne),
                acesAvailable: ethers.formatEther(acesAmountRaw),
              },
              '⚠️ [BondingQuote] Not enough ACES for even 1 token',
            );
          } else {
            // Binary search
            while (left <= right) {
              // Calculate midpoint and round down to nearest whole token
              const midRaw = (left + right) / 2n;
              const mid = (midRaw / oneToken) * oneToken; // Ensure it's a multiple of oneToken

              try {
                const acesCost = await factoryContract.getBuyPriceAfterFee(tokenAddress, mid);

                if (acesCost <= acesAmountRaw) {
                  bestTokenAmount = mid;
                  left = mid + oneToken;
                } else {
                  right = mid - oneToken;
                }
              } catch (error) {
                // Amount too large, try smaller
                right = mid - oneToken;
              }
            }

            expectedRwaOutput = ethers.formatUnits(bestTokenAmount, tokenDecimals);

            fastify.log.info(
              {
                acesAmount: ethers.formatUnits(acesAmountRaw, 18),
                rwaTokens: expectedRwaOutput,
              },
              '✅ [BondingQuote] ACES → RWA calculation complete',
            );
          }
        } catch (error) {
          fastify.log.error(
            { err: error },
            '❌ [BondingQuote] Failed to calculate RWA token output',
          );
          // Continue with 0 output rather than failing the whole request
          expectedRwaOutput = '0';
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
        };

        fastify.log.info(
          {
            inputAsset: response.inputAsset,
            inputAmount: response.inputAmount,
            expectedAcesAmount: response.expectedAcesAmount,
            minAcesAmount: response.minAcesAmount,
            expectedRwaOutput: response.expectedRwaOutput,
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
