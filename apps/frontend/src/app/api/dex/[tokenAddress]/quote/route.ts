import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { getAerodromeService, computeSwap } from '@/lib/services/aerodrome-service';
import { getPriceCacheService } from '@/lib/services/price-cache-service';
import { createRpcProvider, getDefaultRpcUrl } from '@/lib/utils/rpc-provider';

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
  isSlipstream?: boolean;
  tickSpacing?: number;
  poolAddress?: string;
}

// Asset metadata
const assetMetadata = {
  ACES: {
    symbol: 'ACES',
    address: (
      process.env.ACES_TOKEN_ADDRESS ||
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS ||
      '0x55337650856299363c496065C836B9C6E9dE0367'
    ).toLowerCase(),
    decimals: 18,
  },
  USDC: {
    symbol: 'USDC',
    address: (
      process.env.USDC_ADDRESS ||
      process.env.NEXT_PUBLIC_USDC_ADDRESS ||
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    ).toLowerCase(),
    decimals: 6,
  },
  USDT: {
    symbol: 'USDT',
    address: (
      process.env.USDT_ADDRESS ||
      process.env.NEXT_PUBLIC_USDT_ADDRESS ||
      '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
    ).toLowerCase(),
    decimals: 6,
  },
  ETH: {
    symbol: 'ETH',
    address: (
      process.env.WETH_ADDRESS ||
      process.env.NEXT_PUBLIC_WETH_ADDRESS ||
      '0x4200000000000000000000000000000000000006'
    ).toLowerCase(),
    decimals: 18,
  },
  WETH: {
    symbol: 'WETH',
    address: (
      process.env.WETH_ADDRESS ||
      process.env.NEXT_PUBLIC_WETH_ADDRESS ||
      '0x4200000000000000000000000000000000000006'
    ).toLowerCase(),
    decimals: 18,
  },
} as const;

// Request coalescing map
const quoteRequestMap = new Map<string, Promise<QuoteResponse>>();

/** Prefer pool.getAmountOut (dynamic fee); fallback to computeSwap when pool not available. */
async function quoteHop(
  service: ReturnType<typeof getAerodromeService>,
  poolAddress: string | undefined,
  tokenIn: string,
  amountIn: ethers.BigNumber,
  reserveIn: ethers.BigNumber,
  reserveOut: ethers.BigNumber,
): Promise<ethers.BigNumber> {
  if (poolAddress) {
    const out = await service.getAmountOutFromPool(poolAddress, tokenIn, amountIn);
    if (out !== null && !out.isZero()) return out;
  }
  return computeSwap(amountIn, reserveIn, reserveOut);
}

/**
 * GET /api/dex/:tokenAddress/quote
 * Returns DEX quote for swapping tokens
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenAddress: string }> },
) {
  try {
    const { tokenAddress } = await params;
    const { searchParams } = new URL(request.url);

    let inputAssetCode = (searchParams.get('inputAsset') || 'ACES').toUpperCase();
    // Normalize WETH -> ETH
    if (inputAssetCode === 'WETH') {
      inputAssetCode = 'ETH';
    }

    const amountStr = searchParams.get('amount') ?? '0';
    const slippageBps = Number(searchParams.get('slippageBps') ?? '100');

    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    const normalizedToken = tokenAddress.toLowerCase();

    // Request coalescing
    const cacheKey = `${normalizedToken}:${inputAssetCode}:${amountStr}:${slippageBps}`;
    let quotePromise = quoteRequestMap.get(cacheKey);

    if (quotePromise) {
      // Join pending request
      const result = await quotePromise;
      return NextResponse.json({ success: true, data: result });
    }

    // Start new request
    quotePromise = (async () => {
      const service = getAerodromeService(prisma);

      const ERC20_ABI = ['function decimals() view returns (uint8)'];
      const rpcUrl = getDefaultRpcUrl();
      const provider = createRpcProvider(rpcUrl, {
        name: 'base',
        chainId: 8453,
      });
      const tokenContract = new ethers.Contract(normalizedToken, ERC20_ABI, provider);

      // Start price fetch early so it runs in parallel with RPC/DB (we await only when building USD)
      const pricePromise = getPriceCacheService()
        .getPrices()
        .catch(() => null);

      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

      // Run decimals + pool address lookup in parallel. Convex first, then Prisma.
      const [rawDecimalsResult, convexToken, prismaToken] = await Promise.all([
        tokenContract.decimals(),
        convexUrl
          ? import('convex/nextjs').then(({ fetchQuery }) =>
              import('convex/_generated/api').then(({ api }) =>
                fetchQuery(
                  api.tokens.getByContractAddress,
                  { contractAddress: normalizedToken },
                  { url: convexUrl },
                ).catch(() => null),
              ),
            )
          : Promise.resolve(null),
        prisma.token.findUnique({
          where: { contractAddress: normalizedToken },
          select: { poolAddress: true },
        }),
      ]);

      const rawDecimals = rawDecimalsResult;
      const tokenDecimals =
        typeof rawDecimals === 'number'
          ? rawDecimals
          : typeof rawDecimals?.toNumber === 'function'
            ? rawDecimals.toNumber()
            : Number(rawDecimals);

      const isSellMode = inputAssetCode === 'TOKEN';
      let assetConfig: (typeof assetMetadata)[keyof typeof assetMetadata] | null = null;
      let amountInRaw: ethers.BigNumber;

      if (isSellMode) {
        amountInRaw = ethers.utils.parseUnits(amountStr, tokenDecimals);
        assetConfig = null;
      } else {
        assetConfig = assetMetadata[inputAssetCode as keyof typeof assetMetadata];
        if (!assetConfig) {
          throw new Error(
            `Unsupported input asset: ${inputAssetCode}. Supported assets: ACES, ETH, WETH, USDC, USDT, TOKEN.`,
          );
        }
        amountInRaw = ethers.utils.parseUnits(amountStr, assetConfig.decimals);
      }

      // Convex first, then Prisma for pool address
      const knownPoolAddress = convexToken?.poolAddress ?? prismaToken?.poolAddress ?? undefined;

      // Fetch pool state (single RPC path when knownPoolAddress is set)
      const tokenPool = await service.getPoolState(normalizedToken, knownPoolAddress);

      let expectedOutputRaw = ethers.BigNumber.from(0);
      const intermediateSteps: Array<{ symbol: string; amount: string }> = [];
      let outputDecimals: number = tokenDecimals;
      let outputSymbol = 'TOKEN';
      let routePath: string[] = [];
      const routes: Array<{ from: string; to: string; stable: boolean }> = [];

      // Detect Slipstream (CL) pool when V2 pool state is unavailable
      let isSlipstream = false;
      let clTickSpacing: number | null = null;
      if (knownPoolAddress && !tokenPool) {
        const { detectSlipstreamPool } = await import('@/lib/services/slipstream-quote');
        const detection = await detectSlipstreamPool(provider, knownPoolAddress);
        isSlipstream = detection.isSlipstream;
        clTickSpacing = detection.tickSpacing;
        if (!isSlipstream) {
          console.warn(
            '[DEX Quote] Pool address known but neither V2 nor CL for',
            normalizedToken,
            'pool:',
            knownPoolAddress,
          );
          throw new Error('Pool not found or not supported');
        }
      }

      /**
       * Helper: quote the TOKEN ↔ ACES leg through the CL (Slipstream) pool.
       * Returns the output BigNumber or throws.
       */
      async function quoteSlipstreamLeg(
        tokenIn: string,
        tokenOut: string,
        amountIn: ethers.BigNumber,
      ): Promise<ethers.BigNumber> {
        const { getSlipstreamQuote } = await import('@/lib/services/slipstream-quote');
        const clResult = await getSlipstreamQuote(
          provider,
          knownPoolAddress!,
          tokenIn,
          tokenOut,
          amountIn,
          8453,
        );
        if (clResult && !clResult.amountOut.isZero()) {
          if (clResult.tickSpacing != null) clTickSpacing = clResult.tickSpacing;
          return clResult.amountOut;
        }
        throw new Error('Slipstream (CL) quote returned zero — pool may have insufficient liquidity');
      }

      // ================================================================
      // SLIPSTREAM (CL) POOL ROUTING
      // ================================================================
      if (isSlipstream && isSellMode) {
        // TOKEN → ACES via CL pool
        expectedOutputRaw = await quoteSlipstreamLeg(
          normalizedToken,
          assetMetadata.ACES.address,
          amountInRaw,
        );
        outputDecimals = 18;
        outputSymbol = 'ACES';
        routePath = [normalizedToken, assetMetadata.ACES.address];
        routes.push({ from: normalizedToken, to: assetMetadata.ACES.address, stable: false });
      } else if (isSlipstream && !isSellMode && assetConfig!.symbol === 'ACES') {
        // ACES → TOKEN via CL pool
        expectedOutputRaw = await quoteSlipstreamLeg(
          assetMetadata.ACES.address,
          normalizedToken,
          amountInRaw,
        );
        outputDecimals = tokenDecimals;
        outputSymbol = 'TOKEN';
        routePath = [assetMetadata.ACES.address, normalizedToken];
        routes.push({ from: assetMetadata.ACES.address, to: normalizedToken, stable: false });
      } else if (isSlipstream && !isSellMode && assetConfig!.symbol === 'ETH') {
        // ETH → ACES (V2) → TOKEN (CL)
        const envAcesWeth = process.env.AERODROME_ACES_WETH_POOL || '';
        const knownAcesWethPool = envAcesWeth ? envAcesWeth.toLowerCase() : undefined;
        const wethToAces = await service.getPairReserves(
          assetMetadata.ETH.address,
          assetMetadata.ACES.address,
          knownAcesWethPool,
        );
        if (!wethToAces) throw new Error('Route pool not found for ETH → ACES');

        const acesAmountRaw = await quoteHop(
          service,
          wethToAces.poolAddress,
          assetMetadata.ETH.address,
          amountInRaw,
          wethToAces.reserveIn,
          wethToAces.reserveOut,
        );
        intermediateSteps.push({
          symbol: 'ACES',
          amount: ethers.utils.formatUnits(acesAmountRaw, assetMetadata.ACES.decimals),
        });

        expectedOutputRaw = await quoteSlipstreamLeg(
          assetMetadata.ACES.address,
          normalizedToken,
          acesAmountRaw,
        );
        outputDecimals = tokenDecimals;
        outputSymbol = 'TOKEN';
        routePath = [assetMetadata.ETH.address, assetMetadata.ACES.address, normalizedToken];
        routes.push({
          from: assetMetadata.ETH.address,
          to: assetMetadata.ACES.address,
          stable: wethToAces.stable,
        });
        routes.push({ from: assetMetadata.ACES.address, to: normalizedToken, stable: false });
      } else if (
        isSlipstream &&
        !isSellMode &&
        (assetConfig!.symbol === 'USDC' || assetConfig!.symbol === 'USDT')
      ) {
        // USDC/USDT → WETH (V2) → ACES (V2) → TOKEN (CL)
        const stableToWeth = await service.getPairReserves(
          assetConfig!.address,
          assetMetadata.ETH.address,
        );
        const envAcesWeth = process.env.AERODROME_ACES_WETH_POOL || '';
        const knownAcesWethPool = envAcesWeth ? envAcesWeth.toLowerCase() : undefined;
        const wethToAces = await service.getPairReserves(
          assetMetadata.ETH.address,
          assetMetadata.ACES.address,
          knownAcesWethPool,
        );
        if (!stableToWeth || !wethToAces) throw new Error('Route pool not found');

        const wethAmountRaw = await quoteHop(
          service,
          stableToWeth.poolAddress,
          assetConfig!.address,
          amountInRaw,
          stableToWeth.reserveIn,
          stableToWeth.reserveOut,
        );
        intermediateSteps.push({
          symbol: 'wETH',
          amount: ethers.utils.formatUnits(wethAmountRaw, assetMetadata.ETH.decimals),
        });

        const acesAmountRaw = await quoteHop(
          service,
          wethToAces.poolAddress,
          assetMetadata.ETH.address,
          wethAmountRaw,
          wethToAces.reserveIn,
          wethToAces.reserveOut,
        );
        intermediateSteps.push({
          symbol: 'ACES',
          amount: ethers.utils.formatUnits(acesAmountRaw, assetMetadata.ACES.decimals),
        });

        expectedOutputRaw = await quoteSlipstreamLeg(
          assetMetadata.ACES.address,
          normalizedToken,
          acesAmountRaw,
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
          stable: stableToWeth.stable,
        });
        routes.push({
          from: assetMetadata.ETH.address,
          to: assetMetadata.ACES.address,
          stable: wethToAces.stable,
        });
        routes.push({ from: assetMetadata.ACES.address, to: normalizedToken, stable: false });
      }

      // ================================================================
      // V2 (CLASSIC AMM) POOL ROUTING
      // ================================================================
      else if (!isSlipstream && isSellMode) {
        const tokenToAces = tokenPool
          ? {
              poolAddress: tokenPool.poolAddress,
              reserveIn: ethers.BigNumber.from(tokenPool.reserveRaw.token),
              reserveOut: ethers.BigNumber.from(tokenPool.reserveRaw.counter),
              stable: false,
            }
          : await service.getPairReserves(
              normalizedToken,
              assetMetadata.ACES.address,
              knownPoolAddress,
            );

        if (tokenToAces) {
          expectedOutputRaw = await quoteHop(
            service,
            tokenToAces.poolAddress,
            normalizedToken,
            amountInRaw,
            tokenToAces.reserveIn,
            tokenToAces.reserveOut,
          );
          outputDecimals = 18;
          outputSymbol = 'ACES';
          routePath = [normalizedToken, assetMetadata.ACES.address];
          routes.push({
            from: normalizedToken,
            to: assetMetadata.ACES.address,
            stable: tokenToAces.stable,
          });
        } else {
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

          const wethAmountRaw = await quoteHop(
            service,
            tokenToWeth.poolAddress,
            normalizedToken,
            amountInRaw,
            tokenToWeth.reserveIn,
            tokenToWeth.reserveOut,
          );
          expectedOutputRaw = await quoteHop(
            service,
            wethToAces.poolAddress,
            assetMetadata.ETH.address,
            wethAmountRaw,
            wethToAces.reserveIn,
            wethToAces.reserveOut,
          );
          outputDecimals = 18;
          outputSymbol = 'ACES';
          routePath = [normalizedToken, assetMetadata.ETH.address, assetMetadata.ACES.address];
          routes.push({
            from: normalizedToken,
            to: assetMetadata.ETH.address,
            stable: tokenToWeth.stable,
          });
          routes.push({
            from: assetMetadata.ETH.address,
            to: assetMetadata.ACES.address,
            stable: wethToAces.stable,
          });
        }
      } else if (!isSlipstream && assetConfig!.symbol === 'ACES') {
        const directAcesToToken = tokenPool
          ? {
              poolAddress: tokenPool.poolAddress,
              reserveIn: ethers.BigNumber.from(tokenPool.reserveRaw.counter),
              reserveOut: ethers.BigNumber.from(tokenPool.reserveRaw.token),
              stable: false,
            }
          : await service.getPairReserves(
              assetMetadata.ACES.address,
              normalizedToken,
              knownPoolAddress,
            );

        if (directAcesToToken) {
          expectedOutputRaw = await quoteHop(
            service,
            directAcesToToken.poolAddress,
            assetMetadata.ACES.address,
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
            stable: directAcesToToken.stable,
          });
        } else {
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

          const wethAmountRaw = await quoteHop(
            service,
            acesToWeth.poolAddress,
            assetMetadata.ACES.address,
            amountInRaw,
            acesToWeth.reserveIn,
            acesToWeth.reserveOut,
          );
          intermediateSteps.push({
            symbol: 'wETH',
            amount: ethers.utils.formatUnits(wethAmountRaw, assetMetadata.ETH.decimals),
          });

          expectedOutputRaw = await quoteHop(
            service,
            wethToToken.poolAddress,
            assetMetadata.ETH.address,
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
            stable: acesToWeth.stable,
          });
          routes.push({
            from: assetMetadata.ETH.address,
            to: normalizedToken,
            stable: wethToToken.stable,
          });
        }
      } else if (!isSlipstream && assetConfig!.symbol === 'ETH') {
        const wethToToken = await service.getPairReserves(
          assetMetadata.ETH.address,
          normalizedToken,
          knownPoolAddress,
        );

        if (wethToToken) {
          expectedOutputRaw = await quoteHop(
            service,
            wethToToken.poolAddress,
            assetMetadata.ETH.address,
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
            stable: wethToToken.stable,
          });
        } else {
          const envAcesWeth = process.env.AERODROME_ACES_WETH_POOL || '';
          const knownAcesWethPool = envAcesWeth ? envAcesWeth.toLowerCase() : undefined;
          const wethToAces = await service.getPairReserves(
            assetMetadata.ETH.address,
            assetMetadata.ACES.address,
            knownAcesWethPool,
          );
          const acesToToken = await service.getPairReserves(
            assetMetadata.ACES.address,
            normalizedToken,
            knownPoolAddress,
          );

          if (!wethToAces || !acesToToken) {
            throw new Error('Route pool not found');
          }

          const acesAmountRaw = await quoteHop(
            service,
            wethToAces.poolAddress,
            assetMetadata.ETH.address,
            amountInRaw,
            wethToAces.reserveIn,
            wethToAces.reserveOut,
          );
          intermediateSteps.push({
            symbol: 'ACES',
            amount: ethers.utils.formatUnits(acesAmountRaw, assetMetadata.ACES.decimals),
          });

          expectedOutputRaw = await quoteHop(
            service,
            acesToToken.poolAddress,
            assetMetadata.ACES.address,
            acesAmountRaw,
            acesToToken.reserveIn,
            acesToToken.reserveOut,
          );
          outputDecimals = tokenDecimals;
          outputSymbol = 'TOKEN';
          routePath = [assetMetadata.ETH.address, assetMetadata.ACES.address, normalizedToken];
          routes.push({
            from: assetMetadata.ETH.address,
            to: assetMetadata.ACES.address,
            stable: wethToAces.stable,
          });
          routes.push({
            from: assetMetadata.ACES.address,
            to: normalizedToken,
            stable: acesToToken.stable,
          });
        }
      } else if (
        !isSlipstream &&
        (assetConfig!.symbol === 'USDC' || assetConfig!.symbol === 'USDT')
      ) {
        const stableToWeth = await service.getPairReserves(
          assetConfig!.address,
          assetMetadata.ETH.address,
        );
        const wethToToken = await service.getPairReserves(
          assetMetadata.ETH.address,
          normalizedToken,
          knownPoolAddress,
        );

        if (!stableToWeth || !wethToToken) {
          throw new Error('Route pool not found');
        }

        const wethAmountRaw = await quoteHop(
          service,
          stableToWeth.poolAddress,
          assetConfig!.address,
          amountInRaw,
          stableToWeth.reserveIn,
          stableToWeth.reserveOut,
        );
        intermediateSteps.push({
          symbol: 'wETH',
          amount: ethers.utils.formatUnits(wethAmountRaw, assetMetadata.ETH.decimals),
        });

        expectedOutputRaw = await quoteHop(
          service,
          wethToToken.poolAddress,
          assetMetadata.ETH.address,
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
          stable: stableToWeth.stable,
        });
        routes.push({
          from: assetMetadata.ETH.address,
          to: normalizedToken,
          stable: wethToToken.stable,
        });
      }

      if (expectedOutputRaw.isZero()) {
        throw new Error('Insufficient liquidity for this trade size');
      }

      const minOutputRaw = expectedOutputRaw.mul(10000 - slippageBps).div(10000);

      // Calculate USD values
      let inputUsdValue: string | undefined;
      let outputUsdValue: string | undefined;
      const prices: {
        aces?: number;
        weth?: number;
        usdc?: number;
        usdt?: number;
      } = {};

      try {
        const priceData = await pricePromise;
        const acesUsdPrice = priceData?.acesUsd;
        if (priceData && Number.isFinite(acesUsdPrice)) {
          prices.aces = acesUsdPrice;
          prices.usdc = 1.0;
          prices.usdt = 1.0;
          prices.weth = priceData.wethUsd;

          const inputAmount = Number(amountStr);
          if (inputAssetCode === 'TOKEN') {
            const outputInAces = Number(
              ethers.utils.formatUnits(expectedOutputRaw, outputDecimals),
            );
            inputUsdValue = (outputInAces * acesUsdPrice!).toFixed(2);
          } else if (inputAssetCode === 'ACES') {
            inputUsdValue = (inputAmount * acesUsdPrice!).toFixed(2);
          } else if (inputAssetCode === 'ETH' || inputAssetCode === 'WETH') {
            inputUsdValue = (inputAmount * priceData.wethUsd).toFixed(2);
          } else if (inputAssetCode === 'USDC' || inputAssetCode === 'USDT') {
            inputUsdValue = inputAmount.toFixed(2);
          }

          const outputAmount = Number(ethers.utils.formatUnits(expectedOutputRaw, outputDecimals));
          if (outputSymbol === 'TOKEN') {
            // For V2 pools, use pool priceInCounter; for CL pools, derive from input/output amounts
            const tokenPriceInAces = tokenPool?.priceInCounter || 0;

            if (tokenPriceInAces > 0) {
              outputUsdValue = (outputAmount * tokenPriceInAces * acesUsdPrice!).toFixed(2);
            } else if (inputUsdValue) {
              // For CL pools without reserve-based pricing, approximate output USD from input USD
              outputUsdValue = inputUsdValue;
            }
          } else if (outputSymbol === 'ACES') {
            outputUsdValue = (outputAmount * acesUsdPrice!).toFixed(2);
          }
        }
      } catch (error) {
        console.warn('[DEX Quote] Failed to calculate USD values:', error);
      }

      const response: QuoteResponse = {
        inputAsset: inputAssetCode,
        inputAmount: amountStr,
        inputAmountRaw: amountInRaw.toString(),
        expectedOutput: ethers.utils.formatUnits(expectedOutputRaw, outputDecimals),
        expectedOutputRaw: expectedOutputRaw.toString(),
        minOutput: ethers.utils.formatUnits(minOutputRaw, outputDecimals),
        minOutputRaw: minOutputRaw.toString(),
        slippageBps,
        path: routePath,
        routes,
        intermediate: intermediateSteps.length > 0 ? intermediateSteps : undefined,
        inputUsdValue,
        outputUsdValue,
        prices,
        ...(isSlipstream && {
          isSlipstream: true,
          tickSpacing: clTickSpacing ?? undefined,
          poolAddress: knownPoolAddress,
        }),
      };

      return response;
    })();

    quoteRequestMap.set(cacheKey, quotePromise);

    try {
      const result = await quotePromise;
      quoteRequestMap.delete(cacheKey);
      return NextResponse.json(
        { success: true, data: result },
        {
          headers: {
            'Cache-Control': 'public, max-age=3',
          },
        },
      );
    } catch (error) {
      quoteRequestMap.delete(cacheKey);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DEX Quote] Error:', errorMessage);

      if (errorMessage.includes('Route pool not found')) {
        return NextResponse.json(
          { success: false, error: 'Route pool not found' },
          { status: 404 },
        );
      }
      if (errorMessage.includes('Pool not found') || errorMessage.includes('Pool not supported')) {
        return NextResponse.json({ success: false, error: errorMessage }, { status: 404 });
      }

      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DEX Quote] Error:', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
