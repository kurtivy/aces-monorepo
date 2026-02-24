/**
 * Aerodrome Service - Simplified for Next.js
 *
 * Handles Aerodrome pool queries and swap calculations
 */

import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { createRpcProvider, getDefaultRpcUrl } from '../utils/rpc-provider';

const PAIR_ABI = [
  'function getReserves() view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function getAmountOut(uint256 amountIn, address tokenIn) view returns (uint256)',
];

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB, bool stable) view returns (address)',
];

const ERC20_ABI = ['function decimals() view returns (uint8)'];

interface PoolReserves {
  poolAddress: string;
  reserveIn: ethers.BigNumber;
  reserveOut: ethers.BigNumber;
  decimalsIn: number;
  decimalsOut: number;
  stable: boolean;
  /** token0 address of the pool (for callers that need to know ordering without extra RPC) */
  token0?: string;
}

interface GenericPoolState {
  poolAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  stable: boolean;
  lastUpdated: number;
}

export class AerodromeService {
  private provider: ethers.providers.JsonRpcProvider;
  private factoryAddress: string;
  private acesTokenAddress: string;
  private defaultStable: boolean;
  private decimalsCache = new Map<string, number>();

  constructor(private prisma: PrismaClient) {
    const rpcUrl = getDefaultRpcUrl();

    // Use custom provider creation to avoid referrer header issues
    this.provider = createRpcProvider(rpcUrl, {
      name: 'base',
      chainId: 8453,
    });
    this.factoryAddress =
      process.env.AERODROME_FACTORY ||
      process.env.NEXT_PUBLIC_AERODROME_FACTORY ||
      process.env.AERODROME_FACTORY_ADDRESS ||
      '0x420DD381b31aEf6683db6B902084cB0FFECe40Da'; // Base mainnet Aerodrome V2 factory
    this.acesTokenAddress =
      process.env.ACES_TOKEN_ADDRESS ||
      process.env.NEXT_PUBLIC_ACES_TOKEN_ADDRESS ||
      '0x55337650856299363c496065C836B9C6E9dE0367';
    this.defaultStable = process.env.AERODROME_DEFAULT_STABLE === 'true';
  }

  /**
   * Get pair reserves for a token pair
   */
  async getPairReserves(
    tokenIn: string,
    tokenOut: string,
    knownPoolAddress?: string,
  ): Promise<PoolReserves | null> {
    const state = await this.getGenericPoolState(tokenIn, tokenOut, knownPoolAddress);
    if (!state) {
      return null;
    }

    const normalizedIn = tokenIn.toLowerCase();
    const normalizedOut = tokenOut.toLowerCase();

    let reserveIn: ethers.BigNumber;
    let reserveOut: ethers.BigNumber;

    if (state.token0 === normalizedIn && state.token1 === normalizedOut) {
      reserveIn = ethers.BigNumber.from(state.reserve0);
      reserveOut = ethers.BigNumber.from(state.reserve1);
    } else if (state.token0 === normalizedOut && state.token1 === normalizedIn) {
      reserveIn = ethers.BigNumber.from(state.reserve1);
      reserveOut = ethers.BigNumber.from(state.reserve0);
    } else {
      return null;
    }

    const [decimalsIn, decimalsOut] = await Promise.all([
      this.getTokenDecimals(normalizedIn),
      this.getTokenDecimals(normalizedOut),
    ]);

    return {
      poolAddress: state.poolAddress,
      reserveIn,
      reserveOut,
      decimalsIn,
      decimalsOut,
      stable: state.stable,
      token0: state.token0,
    };
  }

  /**
   * Get quoted output from pool using the pool's own getAmountOut (dynamic fee + correct curve).
   * Uses the factory fee and stable/volatile curve as configured on-chain; no hardcoded 2%.
   */
  async getAmountOutFromPool(
    poolAddress: string,
    tokenIn: string,
    amountIn: ethers.BigNumber,
  ): Promise<ethers.BigNumber | null> {
    if (!poolAddress || amountIn.isZero()) {
      return null;
    }
    try {
      const poolContract = new ethers.Contract(poolAddress.toLowerCase(), PAIR_ABI, this.provider);
      const tokenInNorm = tokenIn.toLowerCase();
      const amountOut = await poolContract.getAmountOut(amountIn, tokenInNorm);
      return ethers.BigNumber.from(amountOut);
    } catch (error) {
      console.error('[AerodromeService] getAmountOutFromPool failed:', error);
      return null;
    }
  }

  /**
   * Get generic pool state for a token pair
   */
  private async getGenericPoolState(
    tokenA: string,
    tokenB: string,
    knownPoolAddress?: string,
  ): Promise<GenericPoolState | null> {
    const normalizedA = tokenA.toLowerCase();
    const normalizedB = tokenB.toLowerCase();

    let pair: { address: string; stable: boolean } | null = null;

    // Use known pool address if provided
    if (knownPoolAddress && knownPoolAddress !== ethers.constants.AddressZero) {
      pair = { address: knownPoolAddress.toLowerCase(), stable: false };
    } else {
      pair = await this.resolvePairAddress(normalizedA, normalizedB);
    }

    if (!pair) {
      return null;
    }

    try {
      const pairContract = new ethers.Contract(pair.address, PAIR_ABI, this.provider);
      const [reservesResult, token0Result, token1Result] = await Promise.all([
        pairContract.getReserves(),
        pairContract.token0(),
        pairContract.token1(),
      ]);
      const token0 = (token0Result as string).toLowerCase();
      const token1 = (token1Result as string).toLowerCase();
      const reserve0 = reservesResult[0];
      const reserve1 = reservesResult[1];
      const reserve0Str = reserve0?.toString?.() ?? String(reserve0);
      const reserve1Str = reserve1?.toString?.() ?? String(reserve1);

      return {
        poolAddress: pair.address,
        token0,
        token1,
        reserve0: reserve0Str,
        reserve1: reserve1Str,
        stable: pair.stable,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      console.error(
        '[AerodromeService] Error fetching pool state for',
        tokenA,
        tokenB,
        'pool:',
        knownPoolAddress ?? '(from factory)',
        '- if this is a Slipstream (V3) pool, only V2 AMM is supported. Error:',
        error,
      );
      return null;
    }
  }

  /**
   * Resolve pair address from factory
   */
  private async resolvePairAddress(
    tokenA: string,
    tokenB: string,
  ): Promise<{ address: string; stable: boolean } | null> {
    if (!this.provider || !this.factoryAddress) {
      return null;
    }

    const normalizedA = tokenA.toLowerCase();
    const normalizedB = tokenB.toLowerCase();

    const factory = new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);
    const attempts = this.defaultStable ? [true, false] : [false, true];

    for (const stable of attempts) {
      try {
        const pairAddress = await factory.getPair(normalizedA, normalizedB, stable);
        if (pairAddress && pairAddress !== ethers.constants.AddressZero) {
          return { address: (pairAddress as string).toLowerCase(), stable };
        }
      } catch (error) {
        // Continue to next attempt
      }
    }

    return null;
  }

  /**
   * Get token decimals
   */
  private async getTokenDecimals(tokenAddress: string): Promise<number> {
    const normalized = tokenAddress.toLowerCase();
    const cached = this.decimalsCache.get(normalized);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const contract = new ethers.Contract(normalized, ERC20_ABI, this.provider);
      const value = Number(await contract.decimals());
      this.decimalsCache.set(normalized, value);
      return value;
    } catch (error) {
      // Default to 18 if we can't fetch
      this.decimalsCache.set(normalized, 18);
      return 18;
    }
  }

  /**
   * Get pool state for a token
   */
  async getPoolState(
    tokenAddress: string,
    knownPoolAddress?: string,
  ): Promise<{
    poolAddress: string;
    tokenAddress: string;
    counterToken: string;
    reserves: { token: string; counter: string };
    reserveRaw: { token: string; counter: string };
    priceInCounter: number;
    lastUpdated: number;
  } | null> {
    const normalizedToken = tokenAddress.toLowerCase();
    const acesAddress = this.acesTokenAddress.toLowerCase();

    const pairState = await this.getPairReserves(normalizedToken, acesAddress, knownPoolAddress);
    if (!pairState) {
      return null;
    }

    // getPairReserves(token, aces) always returns reserveIn = token reserve, reserveOut = aces reserve
    // (mapped from pool token0/token1 regardless of order). Do not swap by token0.
    const tokenReserve = pairState.reserveIn;
    const acesReserve = pairState.reserveOut;

    const tokenReserveFormatted = ethers.utils.formatUnits(tokenReserve, pairState.decimalsIn);
    const acesReserveFormatted = ethers.utils.formatUnits(acesReserve, pairState.decimalsOut);

    const priceInCounter =
      parseFloat(tokenReserveFormatted) > 0
        ? parseFloat(acesReserveFormatted) / parseFloat(tokenReserveFormatted)
        : 0;

    return {
      poolAddress: pairState.poolAddress,
      tokenAddress: normalizedToken,
      counterToken: acesAddress,
      reserves: {
        token: tokenReserveFormatted,
        counter: acesReserveFormatted,
      },
      reserveRaw: {
        token: tokenReserve.toString(),
        counter: acesReserve.toString(),
      },
      priceInCounter,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get token0 address from pool
   */
  private async getToken0Address(poolAddress: string): Promise<string> {
    const poolContract = new ethers.Contract(poolAddress, PAIR_ABI, this.provider);
    return ((await poolContract.token0()) as string).toLowerCase();
  }
}

// Singleton instance
let aerodromeServiceInstance: AerodromeService | null = null;

export function getAerodromeService(prisma: PrismaClient): AerodromeService {
  if (!aerodromeServiceInstance) {
    aerodromeServiceInstance = new AerodromeService(prisma);
  }
  return aerodromeServiceInstance;
}

/** Default fee fallback when pool.getAmountOut is unavailable (e.g. non-V2 pool). 200 bps = 2%. */
const DEFAULT_POOL_FEE_BPS = 200;
const FEE_DENOMINATOR = 10000;

/**
 * Compute swap output using constant product formula with a given fee.
 * Prefer AerodromeService.getAmountOutFromPool() so fee and curve come from the pool on-chain.
 * @param feeBps Optional fee in basis points (default 200). Ignored if using getAmountOutFromPool.
 */
export function computeSwap(
  amountIn: ethers.BigNumber,
  reserveIn: ethers.BigNumber,
  reserveOut: ethers.BigNumber,
  feeBps: number = DEFAULT_POOL_FEE_BPS,
): ethers.BigNumber {
  if (reserveIn.isZero() || reserveOut.isZero()) {
    return ethers.BigNumber.from(0);
  }

  const amountInAfterFee = amountIn
    .mul(FEE_DENOMINATOR - Math.min(feeBps, 10000))
    .div(FEE_DENOMINATOR);
  const numerator = amountInAfterFee.mul(reserveOut);
  const denominator = reserveIn.add(amountInAfterFee);
  return denominator.isZero() ? ethers.BigNumber.from(0) : numerator.div(denominator);
}
