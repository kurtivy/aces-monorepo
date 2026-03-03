/**
 * Aerodrome Slipstream (CL / V3) quoting.
 *
 * Uses direct pool-state math instead of the QuoterV2 contract because
 * the on-chain QuoterV2 is wired to the original CL factory, while pools
 * launched through the CL Pool Launcher use a different factory.
 */

import { ethers } from 'ethers';

const CL_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function tickSpacing() view returns (int24)',
  'function liquidity() view returns (uint128)',
  'function fee() view returns (uint24)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)',
];

const Q96 = ethers.BigNumber.from(2).pow(96);

/**
 * Detect whether a pool address is a Slipstream (CL) pool by checking for tickSpacing().
 */
export async function detectSlipstreamPool(
  provider: ethers.providers.Provider,
  poolAddress: string,
): Promise<{
  isSlipstream: boolean;
  tickSpacing: number | null;
  token0: string | null;
  token1: string | null;
}> {
  try {
    const pool = new ethers.Contract(poolAddress.toLowerCase(), CL_POOL_ABI, provider);
    const [token0, token1, tickSpacingRaw] = await Promise.all([
      pool.token0().then((a: string) => a.toLowerCase()),
      pool.token1().then((a: string) => a.toLowerCase()),
      pool.tickSpacing(),
    ]);

    const tickSpacing = safeToNumber(tickSpacingRaw);
    return { isSlipstream: true, tickSpacing, token0, token1 };
  } catch {
    return { isSlipstream: false, tickSpacing: null, token0: null, token1: null };
  }
}

/**
 * Compute exact-input quote from a Slipstream (CL) pool using on-chain state.
 *
 * Reads sqrtPriceX96, liquidity, and fee from the pool and applies
 * the constant-product-within-tick-range formula. Accurate for swaps
 * that stay within the current active tick range (covers the vast
 * majority of practical trade sizes).
 */
export async function getSlipstreamQuote(
  provider: ethers.providers.Provider,
  poolAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountInRaw: ethers.BigNumber,
  _chainId: number = 8453,
): Promise<{ amountOut: ethers.BigNumber; tickSpacing: number } | null> {
  const poolAddr = poolAddress.toLowerCase();
  const normalizedIn = tokenIn.toLowerCase();
  const normalizedOut = tokenOut.toLowerCase();

  try {
    const pool = new ethers.Contract(poolAddr, CL_POOL_ABI, provider);
    const [token0, token1, tickSpacingRaw, liquidityRaw, feeRaw, slot0] = await Promise.all([
      pool.token0().then((a: string) => a.toLowerCase()),
      pool.token1().then((a: string) => a.toLowerCase()),
      pool.tickSpacing(),
      pool.liquidity(),
      pool.fee(),
      pool.slot0(),
    ]);

    const tickSpacing = safeToNumber(tickSpacingRaw);
    const sqrtP = ethers.BigNumber.from(slot0.sqrtPriceX96);
    const L = ethers.BigNumber.from(liquidityRaw);
    const fee = safeToNumber(feeRaw); // parts per million (e.g. 20000 = 2%)

    // Validate token pair
    const zeroForOne =
      (token0 === normalizedIn && token1 === normalizedOut);
    const oneForZero =
      (token0 === normalizedOut && token1 === normalizedIn);

    if (!zeroForOne && !oneForZero) {
      console.warn('[SlipstreamQuote] Token pair mismatch:', {
        pool: poolAddr, token0, token1,
        requestedIn: normalizedIn, requestedOut: normalizedOut,
      });
      return null;
    }

    if (L.isZero()) {
      console.warn('[SlipstreamQuote] Pool has zero liquidity:', poolAddr);
      return null;
    }

    // Apply fee
    const amountAfterFee = amountInRaw.mul(1_000_000 - fee).div(1_000_000);
    if (amountAfterFee.isZero()) return null;

    let amountOut: ethers.BigNumber;

    if (zeroForOne) {
      // token0 → token1: sqrtPrice decreases
      // sqrtP_new = (L * Q96) * sqrtP / ((L * Q96) + amountAfterFee * sqrtP)
      const Lq96 = L.mul(Q96);
      const denom = Lq96.add(amountAfterFee.mul(sqrtP));
      if (denom.isZero()) return null;
      const sqrtP_new = Lq96.mul(sqrtP).div(denom);

      // amountOut = L * (sqrtP - sqrtP_new) / Q96
      amountOut = L.mul(sqrtP.sub(sqrtP_new)).div(Q96);
    } else {
      // token1 → token0: sqrtPrice increases
      // sqrtP_new = sqrtP + amountAfterFee * Q96 / L
      const sqrtP_new = sqrtP.add(amountAfterFee.mul(Q96).div(L));

      // amountOut = L * (sqrtP_new - sqrtP) * Q96 / (sqrtP * sqrtP_new)
      // Split to avoid overflow: (L * delta / sqrtP) * Q96 / sqrtP_new
      const delta = sqrtP_new.sub(sqrtP);
      amountOut = L.mul(delta).div(sqrtP).mul(Q96).div(sqrtP_new);
    }

    if (amountOut.isZero()) return null;

    return { amountOut, tickSpacing };
  } catch (error) {
    console.warn('[SlipstreamQuote] Quote failed for pool', poolAddress, error);
    return null;
  }
}

function safeToNumber(raw: unknown): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  const bn = raw as ethers.BigNumber | { toNumber?: () => number; toString?: () => string };
  if (bn != null && typeof (bn as { toNumber?: () => number }).toNumber === 'function') {
    return (bn as ethers.BigNumber).toNumber();
  }
  const n = Number(bn?.toString?.() ?? bn);
  return Number.isNaN(n) ? 0 : n;
}
