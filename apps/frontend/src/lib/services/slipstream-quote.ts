/**
 * Aerodrome Slipstream (CL / V3) quote via QuoterV2.
 * Used when the token's pool is concentrated liquidity (CL), not V2 AMM.
 */

import { ethers } from 'ethers';
import { getContractAddresses } from '@/lib/contracts/addresses';

const CL_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function tickSpacing() view returns (int24)',
];

// QuoterV2.quoteExactInputSingle reverts with (uint256 amountOut, uint160 sqrtPriceX96After, int24 tickAfter) = 96 bytes
const QUOTER_ABI = [
  'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, int24 tickSpacing, uint256 amountIn, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

const SLIPSTREAM_QUOTER_REVERT_DATA_LEN = 96;

/**
 * Get exact-input quote from a Slipstream (CL) pool using the official QuoterV2.
 * Returns amountOut as BigNumber or null if the pool is not CL or quote fails.
 */
export async function getSlipstreamQuote(
  provider: ethers.providers.Provider,
  poolAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountInRaw: ethers.BigNumber,
  chainId: number = 8453,
): Promise<ethers.BigNumber | null> {
  const addresses = getContractAddresses(chainId);
  const quoterAddress = (addresses as { AERODROME_CL_QUOTER?: string }).AERODROME_CL_QUOTER;
  if (!quoterAddress || quoterAddress === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  const normalizedIn = tokenIn.toLowerCase();
  const normalizedOut = tokenOut.toLowerCase();
  const poolAddr = poolAddress.toLowerCase();

  try {
    const poolContract = new ethers.Contract(poolAddr, CL_POOL_ABI, provider);
    const [token0, token1, tickSpacingRaw] = await Promise.all([
      poolContract.token0().then((a: string) => a.toLowerCase()),
      poolContract.token1().then((a: string) => a.toLowerCase()),
      poolContract.tickSpacing(),
    ]);
    const tickSpacing = (() => {
      if (typeof tickSpacingRaw === 'number' && !Number.isNaN(tickSpacingRaw))
        return tickSpacingRaw;
      const bn = tickSpacingRaw as
        | ethers.BigNumber
        | { toNumber?: () => number; toString?: () => string };
      if (bn != null && typeof (bn as { toNumber?: () => number }).toNumber === 'function') {
        return (bn as ethers.BigNumber).toNumber();
      }
      const n = Number(bn?.toString?.() ?? bn);
      return Number.isNaN(n) ? 0 : n;
    })();

    if (
      !(
        (token0 === normalizedIn && token1 === normalizedOut) ||
        (token0 === normalizedOut && token1 === normalizedIn)
      )
    ) {
      return null;
    }

    const quoter = new ethers.Contract(quoterAddress, QUOTER_ABI, provider);
    const params = {
      tokenIn: normalizedIn,
      tokenOut: normalizedOut,
      tickSpacing,
      amountIn: amountInRaw,
      sqrtPriceLimitX96: 0,
    };

    try {
      const result = await quoter.callStatic.quoteExactInputSingle(params);
      if (result && result.amountOut != null) {
        return ethers.BigNumber.from(result.amountOut);
      }
    } catch (revertErr: unknown) {
      const err = revertErr as { data?: string; error?: { data?: string }; reason?: string };
      const data = err?.data ?? err?.error?.data;
      if (typeof data === 'string' && data.length >= 2) {
        const hex = data.startsWith('0x') ? data.slice(2) : data;
        const len = hex.length / 2;
        const payloadHex =
          len >= SLIPSTREAM_QUOTER_REVERT_DATA_LEN
            ? len === SLIPSTREAM_QUOTER_REVERT_DATA_LEN
              ? hex
              : hex.slice(-SLIPSTREAM_QUOTER_REVERT_DATA_LEN * 2)
            : null;
        if (payloadHex) {
          try {
            const decoded = ethers.utils.defaultAbiCoder.decode(
              ['uint256', 'uint160', 'int24'],
              '0x' + payloadHex,
            );
            if (decoded[0] != null) {
              return ethers.BigNumber.from(decoded[0]);
            }
          } catch {
            // fallback: first 32 bytes as amountOut
            const firstWord = payloadHex.slice(0, 64);
            return ethers.BigNumber.from('0x' + firstWord);
          }
        }
        if (hex.length >= 64) {
          return ethers.BigNumber.from('0x' + hex.slice(0, 64));
        }
      }
      throw revertErr;
    }

    return null;
  } catch (error) {
    console.warn('[SlipstreamQuote] Quote failed for pool', poolAddress, error);
    return null;
  }
}
