"use node";

/**
 * On-chain metrics fetcher for live RWA tokens.
 * Runs as a Convex cron every 3 minutes.
 *
 * Supports both V2 (getReserves) and CL (slot0) Aerodrome pools — new tokens
 * only need an entry in tokenData.ts with a dexPool to be picked up automatically.
 *
 * Price chain: TOKEN → ACES (pool) → WETH (pool reserves) → USD (Chainlink)
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  type Address,
} from "viem";
import { RWA_TOKENS, isTokenLive } from "./tokenData";

// ── Constants ────────────────────────────────────────────────

/** Alchemy RPC for reliability, falls back to Base public RPC */
const BASE_RPC =
  process.env.ALCHEMY_BASE_URL || "https://mainnet.base.org";

/** Chainlink ETH/USD price feed on Base Mainnet (8 decimals) */
const CHAINLINK_ETH_USD =
  "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" as Address;

/** ACES token contract on Base */
const ACES_ADDRESS =
  "0x55337650856299363c496065C836B9C6E9dE0367" as Address;

/** WETH on Base */
const WETH_ADDRESS =
  "0x4200000000000000000000000000000000000006" as Address;

/** Aerodrome V2 Factory — used to discover the ACES/WETH pool */
const V2_FACTORY =
  "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as Address;

/** Multicall3 canonical address on Base */
const MULTICALL3 =
  "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

// ── ABIs (minimal — only the functions we call) ──────────────

const erc20Abi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

/** Aerodrome V2 pool — returns (reserve0, reserve1, blockTimestampLast) */
const v2PoolAbi = parseAbi([
  "function getReserves() view returns (uint256, uint256, uint256)",
]);

/** Aerodrome CL pool — slot0 returns current sqrtPriceX96 and tick */
const clPoolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
]);

/** Aerodrome V2 Factory — returns pool address or zero address if not found */
const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, bool stable) view returns (address)",
]);

/** Chainlink AggregatorV3 — answer is the price with 8 decimals */
const chainlinkAbi = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
]);

// ── Helpers ──────────────────────────────────────────────────

/**
 * In Solidly/Aerodrome pools, token0 is the lower address (hex sort).
 * Returns true if `a` would be token0 relative to `b`.
 */
function isToken0(a: string, b: string): boolean {
  return a.toLowerCase() < b.toLowerCase();
}

/**
 * Convert sqrtPriceX96 to a price ratio (token1 per token0).
 * sqrtPriceX96 = sqrt(price) * 2^96, so price = (sqrtPriceX96 / 2^96)^2.
 * Uses Number — sufficient precision for USD display values.
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const ratio = Number(sqrtPriceX96) / Number(1n << 96n);
  return ratio * ratio;
}

// ── Derived token list from tokenData.ts ─────────────────────

/** Build the list of live tokens with pool info from the single source of truth. */
function getLiveTokens() {
  return RWA_TOKENS.filter(isTokenLive)
    .filter((t) => t.contractAddress && t.dexPool)
    .map((t) => ({
      symbol: t.symbol,
      contractAddress: t.contractAddress! as Address,
      poolAddress: t.dexPool!.address as Address,
      poolType: t.dexPool!.type,
      // Parse communityReward from display string (e.g. "$40,000") to number
      communityReward: t.communityReward
        ? Number(t.communityReward.replace(/[$,]/g, "")) || 0
        : 0,
    }));
}

// ── Main cron action ─────────────────────────────────────────

export const fetchAndSave = internalAction({
  args: {},
  handler: async (ctx) => {
    const client = createPublicClient({
      transport: http(BASE_RPC),
    });

    const liveTokens = getLiveTokens();
    if (liveTokens.length === 0) {
      console.warn("onchainMetrics: no live tokens with pools to process");
      return;
    }

    // ── Discover ACES/WETH pool (V2) ─────────────────────
    // This pool isn't in tokenData.ts (it's not an RWA token pool),
    // so we discover it via factory. It rarely changes.
    let acesWethPool: Address;
    try {
      const result = await client.readContract({
        address: V2_FACTORY,
        abi: factoryAbi,
        functionName: "getPool",
        args: [ACES_ADDRESS, WETH_ADDRESS, false],
      });
      if (!result || result === "0x0000000000000000000000000000000000000000") {
        console.error("onchainMetrics: ACES/WETH pool not found — aborting");
        return;
      }
      acesWethPool = result as Address;
    } catch (e) {
      console.error("onchainMetrics: failed to discover ACES/WETH pool", e);
      return;
    }

    // ── Build a single multicall with all on-chain reads ──
    // Layout:
    //   [0..n-1]       totalSupply per token
    //   [n..2n-1]      balanceOf(pool) per token (RWA tokens locked in LP)
    //   [2n..3n-1]     ACES balanceOf(pool) per token (ACES side of LP)
    //   [3n..4n-1]     pool pricing: getReserves (V2) or slot0 (CL)
    //   [4n]           getReserves for ACES/WETH pool
    //   [4n+1]         Chainlink ETH/USD latestRoundData
    const n = liveTokens.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous contract calls
    const contracts: any[] = [];

    // Per token: totalSupply
    for (const token of liveTokens) {
      contracts.push({
        address: token.contractAddress,
        abi: erc20Abi,
        functionName: "totalSupply",
      });
    }

    // Per token: balanceOf(pool) — RWA tokens locked in LP
    for (const token of liveTokens) {
      contracts.push({
        address: token.contractAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [token.poolAddress],
      });
    }

    // Per token: ACES balanceOf(pool) — ACES side of each pool
    for (const token of liveTokens) {
      contracts.push({
        address: ACES_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [token.poolAddress],
      });
    }

    // Per token pool: V2 → getReserves, CL → slot0
    for (const token of liveTokens) {
      if (token.poolType === "v2") {
        contracts.push({
          address: token.poolAddress,
          abi: v2PoolAbi,
          functionName: "getReserves",
        });
      } else {
        contracts.push({
          address: token.poolAddress,
          abi: clPoolAbi,
          functionName: "slot0",
        });
      }
    }

    // ACES/WETH pool reserves (V2)
    contracts.push({
      address: acesWethPool,
      abi: v2PoolAbi,
      functionName: "getReserves",
    });

    // Chainlink ETH/USD price
    contracts.push({
      address: CHAINLINK_ETH_USD,
      abi: chainlinkAbi,
      functionName: "latestRoundData",
    });

    const results = await client.multicall({
      contracts,
      multicallAddress: MULTICALL3,
      allowFailure: true,
    });

    // ── Parse shared results ──────────────────────────────

    // totalSupply per token [0..n-1]
    const totalSupplies: bigint[] = [];
    for (let i = 0; i < n; i++) {
      const r = results[i];
      totalSupplies.push(r.status === "success" ? (r.result as bigint) : 0n);
    }

    // RWA tokens locked in each pool [n..2n-1]
    const lpBalances: bigint[] = [];
    for (let i = 0; i < n; i++) {
      const r = results[n + i];
      lpBalances.push(r.status === "success" ? (r.result as bigint) : 0n);
    }

    // ACES held in each pool [2n..3n-1]
    const acesInPool: bigint[] = [];
    for (let i = 0; i < n; i++) {
      const r = results[2 * n + i];
      acesInPool.push(r.status === "success" ? (r.result as bigint) : 0n);
    }

    // ACES/WETH reserves [4n]
    const acesWethReservesResult = results[4 * n];
    let acesWethR0 = 0n;
    let acesWethR1 = 0n;
    if (acesWethReservesResult.status === "success") {
      const [r0, r1] = acesWethReservesResult.result as [bigint, bigint, bigint];
      acesWethR0 = r0;
      acesWethR1 = r1;
    }

    // Chainlink ETH/USD [4n+1] — answer has 8 decimals
    const chainlinkResult = results[4 * n + 1];
    let ethPriceUsd = 0;
    if (chainlinkResult.status === "success") {
      const [, answer] = chainlinkResult.result as [bigint, bigint, bigint, bigint, bigint];
      ethPriceUsd = Number(answer) / 1e8;
    }

    if (ethPriceUsd === 0) {
      console.error("onchainMetrics: Chainlink ETH price unavailable — aborting");
      return;
    }

    // ── Calculate ACES price in USD ──────────────────────
    // ACES/WETH is a V2 pool — use reserve ratio
    const wethIsToken0 = isToken0(WETH_ADDRESS, ACES_ADDRESS);
    const wethReserve = wethIsToken0 ? acesWethR0 : acesWethR1;
    const acesReserveInWethPool = wethIsToken0 ? acesWethR1 : acesWethR0;

    const acesPriceWeth =
      acesReserveInWethPool > 0n
        ? Number(wethReserve) / Number(acesReserveInWethPool)
        : 0;
    const acesPriceUsd = acesPriceWeth * ethPriceUsd;

    if (acesPriceUsd === 0) {
      console.error("onchainMetrics: ACES price is zero — aborting");
      return;
    }

    // ── Calculate per-token metrics ──────────────────────
    const metricsToSave: {
      symbol: string;
      tokenPriceUsd: number;
      marketCapUsd: number;
      liquidityUsd: number;
      tradeRewardPct: number;
      eligibleSupply: number;
      communityRewardUsd: number;
      acesPriceUsd: number;
      ethPriceUsd: number;
    }[] = [];

    for (let i = 0; i < n; i++) {
      const token = liveTokens[i];
      const pricingResult = results[3 * n + i];

      // ── Derive tokenPriceInAces based on pool type ──
      let tokenPriceAces = 0;

      if (token.poolType === "v2") {
        // V2: price = acesReserve / tokenReserve from getReserves
        if (pricingResult.status === "success") {
          const [r0, r1] = pricingResult.result as [bigint, bigint, bigint];
          const tokenIsT0 = isToken0(token.contractAddress, ACES_ADDRESS);
          const tokenReserve = tokenIsT0 ? r0 : r1;
          const acesReserve = tokenIsT0 ? r1 : r0;
          tokenPriceAces =
            tokenReserve > 0n
              ? Number(acesReserve) / Number(tokenReserve)
              : 0;
        }
      } else {
        // CL: price from sqrtPriceX96 in slot0
        // sqrtPriceX96ToPrice gives token1-per-token0 ratio
        if (pricingResult.status === "success") {
          const [sqrtPriceX96] = pricingResult.result as [bigint, number, number, number, number, boolean];
          const priceRatio = sqrtPriceX96ToPrice(sqrtPriceX96);
          const tokenIsT0 = isToken0(token.contractAddress, ACES_ADDRESS);
          // token0→token1 price: if TOKEN is token0, ratio = ACES/TOKEN (what we want)
          // if TOKEN is token1, ratio = TOKEN/ACES (invert it)
          tokenPriceAces = tokenIsT0
            ? priceRatio
            : (priceRatio > 0 ? 1 / priceRatio : 0);
        }
      }

      const tokenPriceUsd = tokenPriceAces * acesPriceUsd;

      // Market cap = totalSupply × tokenPriceUsd
      const totalSupplyFormatted = Number(formatUnits(totalSupplies[i], 18));
      const marketCapUsd = totalSupplyFormatted * tokenPriceUsd;

      // Liquidity = USD value of both sides of the pool (works for V2 and CL)
      // Uses actual token balances held by the pool contract
      const tokenInPoolFormatted = Number(formatUnits(lpBalances[i], 18));
      const acesInPoolFormatted = Number(formatUnits(acesInPool[i], 18));
      const liquidityUsd =
        tokenInPoolFormatted * tokenPriceUsd +
        acesInPoolFormatted * acesPriceUsd;

      // Trade reward = communityReward / (eligibleTokens × tokenPriceUsd) × 100
      // Eligible tokens = total supply minus tokens locked in the LP pool
      const eligibleSupply = totalSupplies[i] - lpBalances[i];
      const eligibleFormatted = Number(formatUnits(eligibleSupply, 18));
      const eligibleValueUsd = eligibleFormatted * tokenPriceUsd;
      const tradeRewardPct =
        token.communityReward > 0 && eligibleValueUsd > 0
          ? (token.communityReward / eligibleValueUsd) * 100
          : 0;

      metricsToSave.push({
        symbol: token.symbol,
        tokenPriceUsd,
        marketCapUsd,
        liquidityUsd,
        tradeRewardPct,
        eligibleSupply: eligibleFormatted,
        communityRewardUsd: token.communityReward,
        acesPriceUsd,
        ethPriceUsd,
      });
    }

    // ── Persist to Convex DB ─────────────────────────────
    await ctx.runMutation(internal.tokenMetrics.saveMetrics, {
      metrics: metricsToSave,
    });

    console.log(
      `onchainMetrics: updated ${metricsToSave.length} tokens | ` +
        `ACES=$${acesPriceUsd.toFixed(6)} | ETH=$${ethPriceUsd.toFixed(2)}`,
    );
  },
});
