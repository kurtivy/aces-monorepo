"use node";

/**
 * Real-time WebSocket trade listener.
 *
 * Subscribes to ERC20 Transfer events for all active RWA pool tokens
 * via QuickNode WebSocket. Buffers events by txHash (2s window) to
 * pair the token + ACES legs of a single swap, then writes matched
 * trades to Convex immediately via an internal mutation.
 *
 * Architecture:
 *   - Runs as a Convex internalAction (Node.js runtime)
 *   - Uses viem's webSocket transport + watchEvent for live events
 *   - Buffers logs by txHash; after 2s processes the pair
 *   - Determines BUY/SELL by whether tokens left or entered the pool
 *   - Deduplicates by txHash before insert (same as tradeSyncer)
 *   - Runs for 9 minutes then exits (Convex 10-min action timeout)
 *   - Re-invoked by a cron every 9 minutes to stay alive
 *
 * The existing tradeSyncer (eth_getLogs poller) is kept as a backup
 * safety net on a 5-minute interval to catch anything the WS misses.
 */

import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createPublicClient, webSocket, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { RWA_TOKENS } from "./tokenData";

// ── Constants ────────────────────────────────────────────────

/** ACES token on Base — the quote side of every RWA pool */
const ACES_ADDRESS = "0x55337650856299363c496065c836b9c6e9de0367";

/** ERC20 Transfer event ABI — used by viem's watchEvent */
const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// ── Pool config (derived from tokenData.ts) ──────────────────

/**
 * Active Aerodrome pools to monitor. Built from the main token registry.
 * Only includes active tokens that have both a contract address and a dexPool.
 */
const POOLS = RWA_TOKENS
  .filter((t) => t.contractAddress && t.dexPool && t.isActive)
  .map((t) => ({
    symbol: t.symbol,
    tokenAddress: t.contractAddress!.toLowerCase() as `0x${string}`,
    poolAddress: t.dexPool!.address.toLowerCase() as `0x${string}`,
  }));

/** Quick lookup: pool address → pool config */
const POOL_BY_ADDRESS = new Map(POOLS.map((p) => [p.poolAddress, p]));

/**
 * All token contract addresses to subscribe to (RWA tokens + ACES).
 * viem's watchEvent filters by emitting contract address.
 */
const ALL_TOKEN_ADDRESSES = [
  ...POOLS.map((p) => p.tokenAddress),
  ACES_ADDRESS.toLowerCase() as `0x${string}`,
];

// ── Main listener action ─────────────────────────────────────

/**
 * Long-running action that opens a WebSocket subscription to Transfer
 * events across all monitored pools. Stays alive for 9 minutes, then
 * exits cleanly so the cron can restart it.
 */
export const listen = internalAction({
  args: {},
  handler: async (ctx) => {
    const wsUrl = process.env.QUICKNODE_WS_URL;
    const httpUrl = process.env.QUICKNODE_BASE_URL;

    if (!wsUrl || !httpUrl) {
      console.error(
        "tradeListener: QUICKNODE_WS_URL or QUICKNODE_BASE_URL not set — skipping"
      );
      return;
    }

    if (POOLS.length === 0) {
      console.log("tradeListener: no active pools to monitor");
      return;
    }

    /** WebSocket client for live event subscription */
    const client = createPublicClient({
      chain: base,
      transport: webSocket(wsUrl),
    });

    /** HTTP client for fetching block timestamps (cheaper than WS) */
    const httpClient = createPublicClient({
      chain: base,
      transport: http(httpUrl),
    });

    // ── Tx buffer: correlate Transfer pairs within the same swap tx ──
    //
    // Each swap produces two Transfer events (RWA token + ACES) in the
    // same transaction. We buffer logs by txHash and process them after
    // a 2-second window to allow both legs to arrive.
    const txBuffer = new Map<
      string,
      {
        logs: Array<{
          address: string;
          from: string;
          to: string;
          value: bigint;
          blockNumber: bigint;
        }>;
        timer: ReturnType<typeof setTimeout>;
      }
    >();

    /**
     * Process a buffered transaction — pair RWA + ACES transfers,
     * determine trade direction, and insert into Convex.
     */
    const processTx = async (txHash: string) => {
      const entry = txBuffer.get(txHash);
      if (!entry) return;
      txBuffer.delete(txHash);

      const logs = entry.logs;

      // Need at least 2 Transfer events (RWA leg + ACES leg) to form a trade
      if (logs.length < 2) return;

      // Separate the RWA token transfer from the ACES transfer
      const rwaLog = logs.find(
        (l) => l.address.toLowerCase() !== ACES_ADDRESS.toLowerCase()
      );
      const acesLog = logs.find(
        (l) => l.address.toLowerCase() === ACES_ADDRESS.toLowerCase()
      );

      if (!rwaLog || !acesLog) return;

      // Identify which pool this trade belongs to
      const pool =
        POOL_BY_ADDRESS.get(rwaLog.from.toLowerCase()) ||
        POOL_BY_ADDRESS.get(rwaLog.to.toLowerCase());
      if (!pool) return;

      // Determine trade direction:
      //   - Token leaving pool (from = pool) → user is BUYING
      //   - Token entering pool (to = pool) → user is SELLING
      const isFromPool = rwaLog.from.toLowerCase() === pool.poolAddress;
      const tradeType = isFromPool ? "BUY" : "SELL";
      const trader = isFromPool ? rwaLog.to : rwaLog.from;

      // Fetch the actual block timestamp from the chain.
      // Falls back to wall-clock time if the RPC call fails.
      let blockTimestamp = Math.floor(Date.now() / 1000);
      try {
        const block = await httpClient.getBlock({
          blockNumber: rwaLog.blockNumber,
        });
        blockTimestamp = Number(block.timestamp);
      } catch {
        // Use wall-clock approximation — close enough for near-real-time
      }

      // Insert trade via internal mutation (deduplicates by txHash)
      await ctx.runMutation(internal.tradeListener.insertTrade, {
        txHash,
        tokenAddress: pool.tokenAddress,
        tradeType,
        trader: trader.toLowerCase(),
        tokenAmount: rwaLog.value.toString(),
        acesAmount: acesLog.value.toString(),
        blockNumber: Number(rwaLog.blockNumber),
        timestamp: blockTimestamp,
      });

      console.log(
        `tradeListener: ${tradeType} ${pool.symbol} — tx ${txHash.slice(0, 10)}...`
      );
    };

    // ── Subscribe to Transfer events across all monitored tokens ──
    const unwatch = client.watchEvent({
      events: [TRANSFER_EVENT],
      address: ALL_TOKEN_ADDRESSES,
      onLogs: (logs) => {
        for (const log of logs) {
          const txHash = log.transactionHash;
          if (!txHash) continue;

          const from = log.args.from?.toLowerCase() ?? "";
          const to = log.args.to?.toLowerCase() ?? "";

          // Only buffer events that involve a pool address (swap legs).
          // This filters out regular wallet-to-wallet transfers.
          const involvesPool =
            POOL_BY_ADDRESS.has(from) || POOL_BY_ADDRESS.has(to);
          if (!involvesPool) continue;

          // Add to tx buffer; start a 2s timer on first event for this tx
          if (!txBuffer.has(txHash)) {
            txBuffer.set(txHash, {
              logs: [],
              timer: setTimeout(() => processTx(txHash), 2000),
            });
          }
          txBuffer.get(txHash)!.logs.push({
            address: log.address,
            from,
            to,
            value: log.args.value ?? 0n,
            blockNumber: log.blockNumber ?? 0n,
          });
        }
      },
      onError: (error) => {
        console.error("tradeListener: WebSocket error:", error);
      },
    });

    console.log(
      `tradeListener: listening on ${POOLS.length} pools via WebSocket`
    );

    // Keep alive for 9 minutes (Convex action timeout is 10 min).
    // After this the cron will restart us.
    await new Promise((resolve) => setTimeout(resolve, 9 * 60 * 1000));

    // Clean shutdown — unsubscribe from events
    unwatch();
    console.log("tradeListener: 9-minute window complete, exiting cleanly");
  },
});

// ── Insert mutation ─────────────────────────────────────────────

/**
 * Insert a single trade, deduplicating by txHash.
 *
 * Uses the by_txHash index for O(1) lookup. If the trade already
 * exists (e.g. from the backup tradeSyncer), it's silently skipped.
 *
 * Schema matches the trades table exactly: uses `timestamp` field
 * (not `blockTimestamp`) to stay consistent with existing data.
 */
export const insertTrade = internalMutation({
  args: {
    txHash: v.string(),
    tokenAddress: v.string(),
    tradeType: v.string(),
    trader: v.string(),
    tokenAmount: v.string(),
    acesAmount: v.string(),
    blockNumber: v.number(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Deduplicate — check if this txHash was already inserted
    // (by the backup poller or a previous listener run)
    const existing = await ctx.db
      .query("trades")
      .withIndex("by_txHash", (q) => q.eq("txHash", args.txHash))
      .first();
    if (existing) return;

    await ctx.db.insert("trades", args);
  },
});
