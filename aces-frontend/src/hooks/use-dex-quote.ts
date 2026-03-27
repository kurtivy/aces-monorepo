import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { parseUnits, formatUnits, type Address, zeroAddress } from "viem";
import { TOKENS, AERODROME } from "~/lib/contracts/addresses";
import { SWAP, TOKEN_DECIMALS } from "~/lib/swap/constants";
import type { SwapHop, SwapRoute } from "~/lib/swap/types";

// ── Minimal ABIs for Aerodrome on-chain quoting ─────────────

const V2_POOL_ABI = [
  {
    type: "function",
    name: "getAmountOut",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "tokenIn", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Aerodrome is a Velodrome V2 fork — uses getPool, not getPair
const V2_FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "stable", type: "bool" },
    ],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

const CL_FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "tickSpacing", type: "int24" },
    ],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

// ── Types ───────────────────────────────────────────────────

type PoolInfo = {
  address: Address;
  type: "v2" | "cl";
  /** Whether this is a stable V2 pair (only set when type is "v2") */
  stable?: boolean;
  tickSpacing?: number;
};

type Client = NonNullable<ReturnType<typeof usePublicClient>>;

/** Internal result from the queryFn — carries both display string and route metadata */
interface QuoteResult {
  output: string;
  outputRaw: bigint;
  route: SwapRoute;
}

// ── Pool discovery (cached — pools don't change) ────────────

const poolCache = new Map<string, PoolInfo | null>();

// All valid tick spacings on Aerodrome's CL factory (queried from tickSpacingToFee)
const CL_TICK_SPACINGS = [1, 10, 50, 500, 2000] as const;

async function findPool(
  client: Client,
  tokenA: Address,
  tokenB: Address,
): Promise<PoolInfo | null> {
  const [lo, hi] = tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
  const key = `${lo}:${hi}`;

  if (poolCache.has(key)) return poolCache.get(key)!;

  // Try V2 volatile pair
  try {
    const addr = await client.readContract({
      address: AERODROME.V2_FACTORY as Address,
      abi: V2_FACTORY_ABI,
      functionName: "getPool",
      args: [tokenA, tokenB, false],
    });
    if (addr && addr !== zeroAddress) {
      const pool: PoolInfo = { address: addr, type: "v2", stable: false };
      poolCache.set(key, pool);
      return pool;
    }
  } catch {}

  // Try V2 stable pair
  try {
    const addr = await client.readContract({
      address: AERODROME.V2_FACTORY as Address,
      abi: V2_FACTORY_ABI,
      functionName: "getPool",
      args: [tokenA, tokenB, true],
    });
    if (addr && addr !== zeroAddress) {
      const pool: PoolInfo = { address: addr, type: "v2", stable: true };
      poolCache.set(key, pool);
      return pool;
    }
  } catch {}

  // Try CL factory with common tick spacings
  for (const ts of CL_TICK_SPACINGS) {
    try {
      const addr = await client.readContract({
        address: AERODROME.CL_FACTORY as Address,
        abi: CL_FACTORY_ABI,
        functionName: "getPool",
        args: [tokenA, tokenB, ts],
      });
      if (addr && addr !== zeroAddress) {
        const pool: PoolInfo = { address: addr, type: "cl", tickSpacing: ts };
        poolCache.set(key, pool);
        return pool;
      }
    } catch {}
  }

  poolCache.set(key, null);
  return null;
}

// ── CL pool ABI for direct state reads ──────────────────────

const CL_POOL_STATE_ABI = [
  {
    type: "function", name: "token0", inputs: [],
    outputs: [{ type: "address" }], stateMutability: "view",
  },
  {
    type: "function", name: "token1", inputs: [],
    outputs: [{ type: "address" }], stateMutability: "view",
  },
  {
    type: "function", name: "liquidity", inputs: [],
    outputs: [{ type: "uint128" }], stateMutability: "view",
  },
  {
    type: "function", name: "fee", inputs: [],
    outputs: [{ type: "uint24" }], stateMutability: "view",
  },
  {
    type: "function", name: "slot0", inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

const Q96 = 1n << 96n;
const Q32 = 1n << 32n;
const MAX_UINT256 = (1n << 256n) - 1n;
const MIN_TICK = -887272;
const MAX_TICK = 887272;

function floorDiv(a: number, b: number): number {
  const quotient = Math.trunc(a / b);
  return a < 0 && a % b !== 0 ? quotient - 1 : quotient;
}

function getSqrtRatioAtTick(tick: number): bigint {
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error("Tick out of range");
  }

  const absTick = tick < 0 ? -tick : tick;
  let ratio =
    (absTick & 0x1) !== 0
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;

  if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) {
    ratio = MAX_UINT256 / ratio;
  }

  return (ratio >> 32n) + (ratio % Q32 === 0n ? 0n : 1n);
}

function getCurrentTickBounds(
  tick: number,
  tickSpacing: number,
): { lowerSqrtPriceX96: bigint; upperSqrtPriceX96: bigint } {
  const lowerTick = floorDiv(tick, tickSpacing) * tickSpacing;
  const upperTick = lowerTick + tickSpacing;

  return {
    lowerSqrtPriceX96: getSqrtRatioAtTick(lowerTick),
    upperSqrtPriceX96: getSqrtRatioAtTick(upperTick),
  };
}

// ── Single-hop quote ────────────────────────────────────────

async function quoteHop(
  client: Client,
  pool: PoolInfo,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
): Promise<bigint> {
  if (pool.type === "v2") {
    return client.readContract({
      address: pool.address,
      abi: V2_POOL_ABI,
      functionName: "getAmountOut",
      args: [amountIn, tokenIn],
    });
  }

  if (!pool.tickSpacing || pool.tickSpacing <= 0) {
    throw new Error("Slipstream route is missing tick spacing");
  }

  // CL pool → direct pool-state math that is exact within the current initialized
  // tick range. If the trade would cross the next initialized tick boundary, we
  // reject the quote instead of showing a misleading output.
  const [token0, liquidity, fee, slot0] = await Promise.all([
    client.readContract({ address: pool.address, abi: CL_POOL_STATE_ABI, functionName: "token0" }),
    client.readContract({ address: pool.address, abi: CL_POOL_STATE_ABI, functionName: "liquidity" }),
    client.readContract({ address: pool.address, abi: CL_POOL_STATE_ABI, functionName: "fee" }),
    client.readContract({ address: pool.address, abi: CL_POOL_STATE_ABI, functionName: "slot0" }),
  ]);

  const sqrtP = slot0[0];
  const tick = Number(slot0[1]);
  const L = BigInt(liquidity);
  const feeNum = Number(fee); // parts per million (e.g. 20000 = 2%)

  if (L === 0n) throw new Error("Pool has zero liquidity");

  // Apply fee
  const amountAfterFee = (amountIn * BigInt(1_000_000 - feeNum)) / 1_000_000n;
  if (amountAfterFee === 0n) throw new Error("Amount too small after fee");

  const zeroForOne = tokenIn.toLowerCase() === (token0 as string).toLowerCase();
  const { lowerSqrtPriceX96, upperSqrtPriceX96 } = getCurrentTickBounds(
    tick,
    pool.tickSpacing,
  );

  let sqrtP_new: bigint;
  let amountOut: bigint;
  if (zeroForOne) {
    // token0 → token1: sqrtPrice decreases
    const Lq96 = L * Q96;
    const denom = Lq96 + amountAfterFee * sqrtP;
    sqrtP_new = (Lq96 * sqrtP) / denom;
    if (sqrtP_new < lowerSqrtPriceX96) {
      throw new Error("Slipstream trade too large for a reliable live quote. Reduce size.");
    }
    amountOut = (L * (sqrtP - sqrtP_new)) / Q96;
  } else {
    // token1 → token0: sqrtPrice increases
    sqrtP_new = sqrtP + (amountAfterFee * Q96) / L;
    if (sqrtP_new > upperSqrtPriceX96) {
      throw new Error("Slipstream trade too large for a reliable live quote. Reduce size.");
    }
    const delta = sqrtP_new - sqrtP;
    amountOut = ((L * delta) / sqrtP * Q96) / sqrtP_new;
  }

  if (amountOut === 0n) throw new Error("Quote returned zero output");
  return amountOut;
}

// ── Helper: build a SwapHop from a pool ─────────────────────

function buildHop(pool: PoolInfo, tokenIn: Address, tokenOut: Address): SwapHop {
  return {
    tokenIn,
    tokenOut,
    poolType: pool.type,
    stable: pool.stable ?? false,
    tickSpacing: pool.tickSpacing ?? 0,
    poolAddress: pool.address,
  };
}

// ── Hook ────────────────────────────────────────────────────

interface UseDexQuoteParams {
  tokenAddress?: string;
  tokenDecimals?: number;
  /** Pre-configured pool info from token-data — skips on-chain discovery for TOKEN/ACES pair */
  dexPool?: { address: string; type: "v2" | "cl"; stable?: boolean; tickSpacing?: number };
  amount: string;
  direction: "buy" | "sell";
}

export function useDexQuote({
  tokenAddress,
  tokenDecimals = 18,
  dexPool,
  amount,
  direction,
}: UseDexQuoteParams) {
  const client = usePublicClient();

  // Debounce the user's input
  const [debouncedAmount, setDebouncedAmount] = useState(amount);
  useEffect(() => {
    if (!amount) {
      setDebouncedAmount("");
      return;
    }
    const timer = setTimeout(
      () => setDebouncedAmount(amount),
      SWAP.QUOTE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [amount]);

  const hasValidAmount =
    !!debouncedAmount && parseFloat(debouncedAmount) > 0;

  const quoteQuery = useQuery({
    queryKey: [
      "dex-quote",
      tokenAddress,
      tokenDecimals,
      debouncedAmount,
      direction,
    ],
    queryFn: async (): Promise<QuoteResult> => {
      if (!client || !tokenAddress) throw new Error("Missing params");

      const token = tokenAddress.toLowerCase() as Address;
      const aces = TOKENS.ACES.address.toLowerCase() as Address;

      // All RWA tokens are paired with ACES.
      // Use pre-configured pool info when available (avoids on-chain discovery + rate limits).
      const tokenAcesPool: PoolInfo | null = dexPool
        ? {
            address: dexPool.address as Address,
            type: dexPool.type,
            stable: dexPool.stable ?? false,
            tickSpacing: dexPool.tickSpacing,
          }
        : await findPool(client, token, aces);
      if (!tokenAcesPool) throw new Error("No TOKEN/ACES pool");

      if (direction === "buy") {
        const amountIn = parseUnits(debouncedAmount, TOKEN_DECIMALS.ACES);
        const out = await quoteHop(client, tokenAcesPool, aces, token, amountIn);
        return {
          output: formatUnits(out, tokenDecimals),
          outputRaw: out,
          route: {
            path: [aces, token],
            hops: [buildHop(tokenAcesPool, aces, token)],
            hasSlipstream: tokenAcesPool.type === "cl",
            inputAmountRaw: amountIn,
            estimatedOutputRaw: out,
          },
        };
      }

      if (direction === "sell") {
        const tokenIn = parseUnits(debouncedAmount, tokenDecimals);
        const acesOut = await quoteHop(client, tokenAcesPool, token, aces, tokenIn);
        return {
          output: formatUnits(acesOut, TOKEN_DECIMALS.ACES),
          outputRaw: acesOut,
          route: {
            path: [token, aces],
            hops: [buildHop(tokenAcesPool, token, aces)],
            hasSlipstream: tokenAcesPool.type === "cl",
            inputAmountRaw: tokenIn,
            estimatedOutputRaw: acesOut,
          },
        };
      }

      throw new Error("Unsupported swap direction");
    },
    enabled: hasValidAmount && !!tokenAddress && !!client,
    staleTime: SWAP.QUOTE_REFRESH_MS,
    refetchInterval: hasValidAmount ? SWAP.QUOTE_REFRESH_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Log quote errors to console for debugging
  if (quoteQuery.isError) {
    console.error("[useDexQuote] Quote failed:", quoteQuery.error);
  }

  const isDebouncing =
    amount !== debouncedAmount && !!amount && parseFloat(amount) > 0;

  return {
    estimatedOutput: quoteQuery.data?.output ?? "",
    /** Full route metadata for swap execution — null while loading or on error */
    swapRoute: quoteQuery.data?.route ?? null,
    isLoading: quoteQuery.isLoading || isDebouncing,
    isRefreshing: quoteQuery.isFetching && !quoteQuery.isLoading,
    isUnavailable: quoteQuery.isError,
    quoteError: quoteQuery.error instanceof Error ? quoteQuery.error.message : null,
    refreshQuote: async () => {
      const result = await quoteQuery.refetch();
      return result.data?.route ?? null;
    },
  };
}
