"use node";

/**
 * Trade syncer — fetches swap activity from Aerodrome pools via
 * eth_getLogs (standard JSON-RPC, 60 CU on Alchemy vs 120 CU for
 * alchemy_getAssetTransfers).
 *
 * Uses two batched eth_getLogs calls across ALL pools (not per-pool),
 * filtering by the ERC20 Transfer event signature. Transfers are then
 * correlated by txHash to build complete trade records.
 *
 * Runs as a Convex cron every 3 minutes.
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createPublicClient, http } from "viem";
import { RWA_TOKENS } from "./tokenData";

// ── Constants ────────────────────────────────────────────────

/** ACES token on Base — the quote side of every RWA pool */
const ACES_ADDRESS = "0x55337650856299363c496065c836b9c6e9de0367";

/** Key used to persist block cursor in the syncCursors table */
const CURSOR_KEY = "tradeSyncer";

/**
 * ERC20 Transfer(address indexed from, address indexed to, uint256 value)
 * keccak256 hash of the event signature — used as topics[0] filter.
 */
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Max block range per eth_getLogs query. Alchemy's free tier on Base
 * caps at 10 blocks per request. Normal 3-minute polling (~90 blocks)
 * needs ~9 chunks, which completes quickly.
 */
const MAX_BLOCK_RANGE = 10;

// ── Pool config (derived from tokenData.ts) ──────────────────

/**
 * Aerodrome pools to monitor. Built from the main token registry —
 * only includes active tokens that have both a contract address and a dexPool.
 */
const POOLS = RWA_TOKENS
  .filter((t) => t.contractAddress && t.dexPool && t.isActive)
  .map((t) => ({
    symbol: t.symbol,
    tokenAddress: t.contractAddress!.toLowerCase(),
    poolAddress: t.dexPool!.address.toLowerCase(),
  }));

// ── Helpers ───────────────────────────────────────────────────

/**
 * Pad a 20-byte address to a 32-byte hex topic for eth_getLogs filtering.
 * e.g. "0xabcd..." → "0x000000000000000000000000abcd..."
 */
function padAddress(addr: string): string {
  return "0x" + addr.slice(2).toLowerCase().padStart(64, "0");
}

/** Shape of a single log entry returned by eth_getLogs */
interface RawLog {
  address: string; // token contract that emitted the Transfer
  topics: string[]; // [eventSig, from (padded), to (padded)]
  data: string; // uint256 value (hex-encoded amount)
  blockNumber: string; // hex block number
  transactionHash: string;
}

/**
 * Fetch logs from the RPC via eth_getLogs. Unlike alchemy_getAssetTransfers
 * (120 CU), this costs 60 CU per call. We batch all pools into a single
 * call by passing arrays for address and topics.
 */
async function fetchLogs(
  rpcUrl: string,
  params: {
    fromBlock: string;
    toBlock: string;
    address: string[];
    topics: (string | string[] | null)[];
  },
): Promise<RawLog[]> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [params],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RPC HTTP error: ${res.status} — ${body}`);
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }

  return json.result || [];
}

/**
 * Fetch block timestamps for a set of block numbers.
 * Uses eth_getBlockByNumber (16 CU each) — only called for blocks
 * that actually contain trades, so typically 0–5 per tick.
 */
async function fetchBlockTimestamps(
  rpcUrl: string,
  blockNumbers: Set<string>,
): Promise<Map<string, number>> {
  const timestamps = new Map<string, number>();

  // Fetch in parallel for speed
  const entries = [...blockNumbers];
  const results = await Promise.all(
    entries.map(async (blockHex) => {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBlockByNumber",
          // false = don't include full tx objects (cheaper)
          params: [blockHex, false],
        }),
      });
      const json = await res.json();
      // Block timestamp is hex-encoded unix seconds
      const ts = json.result?.timestamp
        ? parseInt(json.result.timestamp, 16)
        : 0;
      return [blockHex, ts] as const;
    }),
  );

  for (const [blockHex, ts] of results) {
    timestamps.set(blockHex, ts);
  }

  return timestamps;
}

// ── Derived constants (computed once at module load) ──────────

/** All token contract addresses to filter logs by (RWA tokens + ACES) */
const ALL_TOKEN_ADDRESSES = [
  ...POOLS.map((p) => p.tokenAddress),
  ACES_ADDRESS,
];

/** All pool addresses padded to 32 bytes for topic filtering */
const ALL_POOL_TOPICS = POOLS.map((p) => padAddress(p.poolAddress));

/** Quick lookup: pool address → pool config */
const POOL_BY_ADDRESS = new Map(
  POOLS.map((p) => [p.poolAddress.toLowerCase(), p]),
);

// ── Main sync action ─────────────────────────────────────────

export const syncTrades = internalAction({
  args: {},
  handler: async (ctx) => {
    const rpcUrl = process.env.ALCHEMY_BASE_URL;
    if (!rpcUrl) {
      console.error("tradeSyncer: ALCHEMY_BASE_URL not set, skipping");
      return;
    }

    // Read cursor — the last block number we've fully processed
    const cursor: number | null = await ctx.runQuery(
      internal.trades.getSyncCursor,
      { key: CURSOR_KEY },
    );

    // Fetch current block to know the query ceiling and advance cursor
    let currentBlock: number;
    try {
      const client = createPublicClient({ transport: http(rpcUrl) });
      currentBlock = Number(await client.getBlockNumber());
    } catch (e) {
      console.error("tradeSyncer: failed to get block number, skipping");
      return;
    }

    // If cursor is already at current block, nothing to do
    if (cursor !== null && cursor >= currentBlock) return;

    // Start one block after cursor, or from genesis on first run
    const startBlock = cursor !== null ? cursor + 1 : 0;

    /**
     * Chunk the block range to stay within Alchemy's per-query limit.
     * For normal 3-minute polling (~90 blocks), this is ~9 chunks.
     */
    let totalSwaps = 0;
    for (
      let chunkStart = startBlock;
      chunkStart <= currentBlock;
      chunkStart += MAX_BLOCK_RANGE
    ) {
      const chunkEnd = Math.min(chunkStart + MAX_BLOCK_RANGE - 1, currentBlock);
      const fromBlock = "0x" + chunkStart.toString(16);
      const toBlock = "0x" + chunkEnd.toString(16);

      let fromPoolLogs: RawLog[];
      let toPoolLogs: RawLog[];

      try {
        /**
         * Two API calls cover ALL pools (not per-pool):
         * 1. Transfer events FROM any pool (tokens leaving pool → BUY/SELL payout)
         * 2. Transfer events TO any pool (tokens entering pool → BUY payment / SELL deposit)
         *
         * address[] = all RWA tokens + ACES (only these contracts)
         * topics[1]/[2] = pool addresses with OR matching across all pools
         */
        [fromPoolLogs, toPoolLogs] = await Promise.all([
          fetchLogs(rpcUrl, {
            fromBlock,
            toBlock,
            address: ALL_TOKEN_ADDRESSES,
            topics: [TRANSFER_TOPIC, ALL_POOL_TOPICS, null],
          }),
          fetchLogs(rpcUrl, {
            fromBlock,
            toBlock,
            address: ALL_TOKEN_ADDRESSES,
            topics: [TRANSFER_TOPIC, null, ALL_POOL_TOPICS],
          }),
        ]);
      } catch (e) {
        console.error(`tradeSyncer: failed fetching logs: ${e}`);
        // Still advance cursor to chunkEnd so we don't re-fetch on retry
        break;
      }

      // Skip correlation if no logs in this chunk
      if (fromPoolLogs.length === 0 && toPoolLogs.length === 0) continue;

      // ── Collect unique block numbers for timestamp lookup ────
      const blockNumbers = new Set<string>();
      for (const log of [...fromPoolLogs, ...toPoolLogs]) {
        blockNumbers.add(log.blockNumber);
      }

      // Fetch timestamps for blocks that contain trades (16 CU each)
      let blockTimestamps: Map<string, number>;
      try {
        blockTimestamps = await fetchBlockTimestamps(rpcUrl, blockNumbers);
      } catch (e) {
        console.error(`tradeSyncer: failed fetching block timestamps: ${e}`);
        break;
      }

      // ── Correlate logs by txHash ──────────────────────────────
      // Each swap produces two Transfer events in the same tx:
      //   - RWA token moving one direction
      //   - ACES moving the other direction
      // We group by txHash to pair them into a single trade record.
      const byTx = new Map<
        string,
        {
          rwaAmount?: string;
          acesAmount?: string;
          type?: "BUY" | "SELL";
          trader?: string;
          tokenAddress?: string;
          blockNumber?: string;
          timestamp?: number;
        }
      >();

      /**
       * Parse a raw log into its components.
       * topics[1] = from address (padded), topics[2] = to address (padded)
       * data = uint256 amount (hex). Address of the emitting contract = token.
       */
      const parseTopic = (topic: string) =>
        "0x" + topic.slice(26).toLowerCase();

      // Process logs FROM pool (tokens leaving pool)
      for (const log of fromPoolLogs) {
        const token = log.address.toLowerCase();
        const from = parseTopic(log.topics[1]); // pool address
        const to = parseTopic(log.topics[2]); // recipient
        const amount = BigInt(log.data).toString();
        const pool = POOL_BY_ADDRESS.get(from);
        if (!pool) continue;

        const entry = byTx.get(log.transactionHash) || {};

        if (token === pool.tokenAddress) {
          // RWA token leaving pool → user is BUYING
          entry.type = "BUY";
          entry.rwaAmount = amount;
          entry.trader = to; // recipient = buyer
          entry.tokenAddress = pool.tokenAddress;
        } else if (token === ACES_ADDRESS) {
          // ACES leaving pool → payout to seller
          entry.acesAmount = amount;
        }

        entry.blockNumber = log.blockNumber;
        entry.timestamp = blockTimestamps.get(log.blockNumber) ?? 0;
        byTx.set(log.transactionHash, entry);
      }

      // Process logs TO pool (tokens entering pool)
      for (const log of toPoolLogs) {
        const token = log.address.toLowerCase();
        const from = parseTopic(log.topics[1]); // sender
        const to = parseTopic(log.topics[2]); // pool address
        const amount = BigInt(log.data).toString();
        const pool = POOL_BY_ADDRESS.get(to);
        if (!pool) continue;

        const entry = byTx.get(log.transactionHash) || {};

        if (token === pool.tokenAddress) {
          // RWA token entering pool → user is SELLING
          entry.type = "SELL";
          entry.rwaAmount = amount;
          entry.trader = from; // sender = seller
          entry.tokenAddress = pool.tokenAddress;
        } else if (token === ACES_ADDRESS) {
          // ACES entering pool → payment from buyer
          entry.acesAmount = amount;
        }

        entry.blockNumber = log.blockNumber;
        entry.timestamp = blockTimestamps.get(log.blockNumber) ?? 0;
        byTx.set(log.transactionHash, entry);
      }

      // ── Build trade records ──────────────────────────────────
      const trades = [];
      for (const [txHash, data] of byTx) {
        // Skip incomplete entries — LP adds/removes won't have both
        // a direction (BUY/SELL) and a trader
        if (!data.type || !data.rwaAmount || !data.trader || !data.tokenAddress)
          continue;

        trades.push({
          txHash,
          tokenAddress: data.tokenAddress,
          tradeType: data.type,
          trader: data.trader,
          tokenAmount: data.rwaAmount,
          acesAmount: data.acesAmount ?? "0",
          blockNumber: parseInt(data.blockNumber || "0", 16),
          timestamp: data.timestamp ?? 0,
        });
      }

      // ── Insert trades ──────────────────────────────────────
      // Pruning is handled by a separate hourly cron (trades.pruneAllTokens).
      if (trades.length > 0) {
        // Insert in chunks of 100 to stay under Convex's 4096
        // per-mutation read limit (each trade = 1 dedup read)
        for (let i = 0; i < trades.length; i += 100) {
          await ctx.runMutation(internal.trades.insertBatch, {
            trades: trades.slice(i, i + 100),
          });
        }
        totalSwaps += trades.length;
      }
    }

    // Always advance cursor to current block, even if no trades found.
    // Prevents re-fetching the same empty range every tick.
    await ctx.runMutation(internal.trades.setSyncCursor, {
      key: CURSOR_KEY,
      blockNumber: currentBlock,
    });

    console.log(
      `tradeSyncer: synced to block ${currentBlock}, found ${totalSwaps} swaps`,
    );
  },
});

// ── Fast backfill via alchemy_getAssetTransfers ──────────────

/**
 * Fast backfill for a single pool's trades using Alchemy's Transfers API.
 * Fetches ALL ERC20 transfers for the pool address in a few paginated calls
 * instead of scanning block-by-block.
 *
 * Run from the Convex dashboard:  { symbol: "PIKACHU" }
 *
 * Safe to run multiple times — trades are deduplicated by txHash.
 */
export const backfillTrades = internalAction({
  args: { symbol: v.string() },
  handler: async (ctx, { symbol }) => {
    const rpcUrl = process.env.ALCHEMY_BASE_URL;
    if (!rpcUrl) {
      console.error("backfillTrades: ALCHEMY_BASE_URL not set");
      return;
    }

    const pool = POOLS.find((p) => p.symbol === symbol);
    if (!pool) {
      console.error(`backfillTrades: unknown symbol "${symbol}"`);
      return;
    }

    const poolAddr = pool.poolAddress.toLowerCase();
    const tokenAddr = pool.tokenAddress.toLowerCase();

    // Step 1: Fetch ALL transfers involving the pool (both directions).
    // A swap has two legs in the same tx (e.g., RWA out + ACES in), so we
    // need both fromAddress and toAddress results to pair them by txHash.
    type RawTransfer = {
      hash: string;
      from: string;
      to: string;
      blockNum: string;
      rawContract?: { address?: string; value?: string };
      metadata?: { blockTimestamp?: string };
    };
    const allTransfers: RawTransfer[] = [];

    for (const direction of ["from", "to"] as const) {
      let pageKey: string | undefined;

      do {
        const params: Record<string, unknown> = {
          [direction === "from" ? "fromAddress" : "toAddress"]: poolAddr,
          category: ["erc20"],
          order: "asc",
          maxCount: "0x3e8", // 1000 per page
          withMetadata: true,
        };
        if (pageKey) params.pageKey = pageKey;

        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getAssetTransfers",
            params: [params],
          }),
        });

        const json = await res.json();
        if (json.error) {
          console.error("backfillTrades: RPC error:", json.error.message);
          return;
        }

        const transfers = json.result?.transfers ?? [];
        pageKey = json.result?.pageKey;
        allTransfers.push(...transfers);

        console.log(
          `backfillTrades: ${symbol} ${direction} — fetched ${transfers.length} transfers. ` +
            `${pageKey ? "More pages..." : "Done."}`,
        );
      } while (pageKey);
    }

    // Step 2: Group all transfers by txHash to pair RWA + ACES legs.
    const byTx = new Map<
      string,
      {
        rwaAmount?: string;
        acesAmount?: string;
        type?: "BUY" | "SELL";
        trader?: string;
        tokenAddress?: string;
        blockNumber?: number;
        timestamp?: number;
      }
    >();

    for (const tx of allTransfers) {
      const asset = tx.rawContract?.address?.toLowerCase();
      const hash = tx.hash;
      if (!asset || !hash) continue;

      const entry = byTx.get(hash) || {};
      const from = tx.from?.toLowerCase();
      const to = tx.to?.toLowerCase();

      if (asset === tokenAddr) {
        // RWA token transfer — direction depends on whether pool sent or received
        if (from === poolAddr) {
          // Token leaving pool → BUY
          entry.type = "BUY";
          entry.trader = to;
        } else if (to === poolAddr) {
          // Token entering pool → SELL
          entry.type = "SELL";
          entry.trader = from;
        }
        entry.rwaAmount = tx.rawContract?.value
          ? BigInt(tx.rawContract.value).toString()
          : "0";
        entry.tokenAddress = tokenAddr;
      } else if (asset === ACES_ADDRESS) {
        entry.acesAmount = tx.rawContract?.value
          ? BigInt(tx.rawContract.value).toString()
          : "0";
      }

      entry.blockNumber = parseInt(tx.blockNum, 16) || 0;
      entry.timestamp = tx.metadata?.blockTimestamp
        ? Math.floor(new Date(tx.metadata.blockTimestamp).getTime() / 1000)
        : 0;

      byTx.set(hash, entry);
    }

    // Step 3: Build trade records from paired transfers and insert.
    const trades = [];
    for (const [txHash, data] of byTx) {
      if (!data.type || !data.rwaAmount || !data.trader || !data.tokenAddress)
        continue;
      trades.push({
        txHash,
        tokenAddress: data.tokenAddress,
        tradeType: data.type,
        trader: data.trader,
        tokenAmount: data.rwaAmount,
        acesAmount: data.acesAmount ?? "0",
        blockNumber: data.blockNumber ?? 0,
        timestamp: data.timestamp ?? 0,
      });
    }

    // Insert in batches (deduplicated by txHash in insertBatch)
    for (let i = 0; i < trades.length; i += 100) {
      await ctx.runMutation(internal.trades.insertBatch, {
        trades: trades.slice(i, i + 100),
      });
    }

    console.log(
      `backfillTrades: ${symbol} complete — ${allTransfers.length} transfers → ${trades.length} trades inserted`,
    );
  },
});

// ── Legacy backfill (disabled — use backfillTrades instead) ──

/**
 * Block range per backfill query. Alchemy free tier on Base
 * caps eth_getLogs at 10 blocks per request.
 */
const BACKFILL_BLOCK_RANGE = 10;

/**
 * Delay between chunks to stay under Alchemy's 330 CU/s rate limit.
 * Each chunk = 2 eth_getLogs × 60 CU = 120 CU. At 400ms spacing
 * that's ~300 CU/s, safely under the limit.
 */
const BACKFILL_PACE_MS = 400;

/** Max retries per chunk for transient errors (rate limits) */
const BACKFILL_MAX_RETRIES = 3;

/**
 * Time budget per invocation in ms. After this, the action saves
 * progress and self-schedules a continuation. Leaves 2 min buffer
 * before Convex's 10-minute action timeout.
 */
const BACKFILL_TIME_BUDGET_MS = 8 * 60 * 1000;

/** Delay before self-scheduled continuation (60s breathing room) */
const BACKFILL_RESCHEDULE_DELAY_MS = 60_000;

/**
 * Fetch with retry and exponential backoff for transient errors
 * (rate limits, timeouts). Retries up to BACKFILL_MAX_RETRIES times
 * with exponential backoff (1s, 2s, 4s) before giving up.
 */
async function fetchLogsWithRetry(
  rpcUrl: string,
  params: {
    fromBlock: string;
    toBlock: string;
    address: string[];
    topics: (string | string[] | null)[];
  },
): Promise<RawLog[]> {
  for (let attempt = 0; attempt <= BACKFILL_MAX_RETRIES; attempt++) {
    try {
      return await fetchLogs(rpcUrl, params);
    } catch (e) {
      if (attempt === BACKFILL_MAX_RETRIES) throw e;
      // Exponential backoff: 1s, 2s, 4s
      const delay = 1000 * Math.pow(2, attempt);
      console.log(
        `backfillPool: retry ${attempt + 1}/${BACKFILL_MAX_RETRIES} after ${delay}ms — ${e}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("fetchLogsWithRetry: exhausted retries");
}

/**
 * Resumable, self-scheduling backfill for a single pool's trades.
 * Uses Alchemy (ALCHEMY_BASE_URL) with 10-block chunks and pacing
 * to stay under the free tier's 330 CU/s rate limit.
 *
 * Trigger once from the Convex dashboard — it self-schedules
 * continuations every 60s until caught up. Cancel anytime from
 * the dashboard's "Scheduled Functions" tab.
 *
 * Progress is saved after each chunk to a cursor ("backfill:<SYMBOL>").
 * The `days` param is only used on the first run; subsequent runs
 * resume from the saved cursor.
 *
 * Call from dashboard:  { symbol: "PIKACHU", days: 13 }
 * Total CU for 13 days: ~6.7M (2.2% of free tier monthly budget)
 *
 * Safe to run multiple times — trades are deduplicated by txHash.
 */
export const backfillPool = internalAction({
  args: {
    symbol: v.string(),
    days: v.number(),
  },
  handler: async (ctx, { symbol, days }) => {
    const rpcUrl = process.env.ALCHEMY_BASE_URL;
    if (!rpcUrl) {
      console.error("backfillPool: ALCHEMY_BASE_URL not set");
      return;
    }

    // Look up pool config by symbol
    const pool = POOLS.find((p) => p.symbol === symbol);
    if (!pool) {
      console.error(`backfillPool: unknown symbol "${symbol}"`);
      return;
    }

    // Get current block
    let currentBlock: number;
    try {
      const client = createPublicClient({ transport: http(rpcUrl) });
      currentBlock = Number(await client.getBlockNumber());
    } catch (e) {
      console.error("backfillPool: failed to get block number");
      return;
    }

    // Check for existing backfill cursor (resume from previous run)
    const backfillKey = `backfill:${symbol}`;
    const savedCursor: number | null = await ctx.runQuery(
      internal.trades.getSyncCursor,
      { key: backfillKey },
    );

    // Calculate start block: resume from cursor, or compute from days
    const blocksPerDay = 43_200;
    const calculatedStart = Math.max(0, currentBlock - days * blocksPerDay);
    const startBlock = savedCursor !== null ? savedCursor + 1 : calculatedStart;

    // Already caught up — nothing to do
    if (startBlock >= currentBlock) {
      console.log(
        `backfillPool: ${symbol} already caught up to block ${currentBlock}`,
      );
      return;
    }

    const totalBlocks = currentBlock - startBlock;
    console.log(
      `backfillPool: ${symbol} scanning blocks ${startBlock} → ${currentBlock}` +
        ` (${totalBlocks} blocks${savedCursor !== null ? ", resuming from cursor" : ""})`,
    );

    // Build pool-specific filter arrays
    const tokenAddresses = [pool.tokenAddress, ACES_ADDRESS];
    const poolTopics = [padAddress(pool.poolAddress)];
    const poolByAddress = new Map([[pool.poolAddress.toLowerCase(), pool]]);
    const parseTopic = (topic: string) =>
      "0x" + topic.slice(26).toLowerCase();

    let totalSwaps = 0;
    let chunksProcessed = 0;
    const actionStart = Date.now();

    for (
      let chunkStart = startBlock;
      chunkStart <= currentBlock;
      chunkStart += BACKFILL_BLOCK_RANGE
    ) {
      // Check time budget — self-schedule continuation if running long
      if (Date.now() - actionStart > BACKFILL_TIME_BUDGET_MS) {
        console.log(
          `backfillPool: ${symbol} time budget reached after ${chunksProcessed} chunks ` +
            `(${totalSwaps} trades). Scheduling continuation in ${BACKFILL_RESCHEDULE_DELAY_MS / 1000}s.`,
        );
        await ctx.scheduler.runAfter(
          BACKFILL_RESCHEDULE_DELAY_MS,
          internal.tradeSyncer.backfillPool,
          { symbol, days },
        );
        return;
      }

      const chunkEnd = Math.min(
        chunkStart + BACKFILL_BLOCK_RANGE - 1,
        currentBlock,
      );
      const fromBlock = "0x" + chunkStart.toString(16);
      const toBlock = "0x" + chunkEnd.toString(16);

      let fromPoolLogs: RawLog[];
      let toPoolLogs: RawLog[];

      try {
        [fromPoolLogs, toPoolLogs] = await Promise.all([
          fetchLogsWithRetry(rpcUrl, {
            fromBlock,
            toBlock,
            address: tokenAddresses,
            topics: [TRANSFER_TOPIC, poolTopics, null],
          }),
          fetchLogsWithRetry(rpcUrl, {
            fromBlock,
            toBlock,
            address: tokenAddresses,
            topics: [TRANSFER_TOPIC, null, poolTopics],
          }),
        ]);
      } catch (e) {
        // Retries exhausted — save progress, schedule retry later
        console.error(
          `backfillPool: ${symbol} stopping at block ${chunkStart} after retries exhausted: ${e}`,
        );
        console.log(
          `backfillPool: scheduling retry in ${BACKFILL_RESCHEDULE_DELAY_MS / 1000}s`,
        );
        await ctx.scheduler.runAfter(
          BACKFILL_RESCHEDULE_DELAY_MS,
          internal.tradeSyncer.backfillPool,
          { symbol, days },
        );
        return;
      }

      chunksProcessed++;

      if (fromPoolLogs.length === 0 && toPoolLogs.length === 0) {
        // Save cursor even for empty chunks so we don't re-scan them
        await ctx.runMutation(internal.trades.setSyncCursor, {
          key: backfillKey,
          blockNumber: chunkEnd,
        });
        await new Promise((r) => setTimeout(r, BACKFILL_PACE_MS));
        continue;
      }

      // Fetch block timestamps
      const blockNumbers = new Set<string>();
      for (const log of [...fromPoolLogs, ...toPoolLogs]) {
        blockNumbers.add(log.blockNumber);
      }

      let blockTimestamps: Map<string, number>;
      try {
        blockTimestamps = await fetchBlockTimestamps(rpcUrl, blockNumbers);
      } catch (e) {
        console.error(
          `backfillPool: ${symbol} stopping — failed fetching timestamps: ${e}`,
        );
        await ctx.scheduler.runAfter(
          BACKFILL_RESCHEDULE_DELAY_MS,
          internal.tradeSyncer.backfillPool,
          { symbol, days },
        );
        return;
      }

      // ── Correlate logs by txHash (same logic as syncTrades) ──
      const byTx = new Map<
        string,
        {
          rwaAmount?: string;
          acesAmount?: string;
          type?: "BUY" | "SELL";
          trader?: string;
          tokenAddress?: string;
          blockNumber?: string;
          timestamp?: number;
        }
      >();

      for (const log of fromPoolLogs) {
        const token = log.address.toLowerCase();
        const from = parseTopic(log.topics[1]);
        const to = parseTopic(log.topics[2]);
        const amount = BigInt(log.data).toString();
        const p = poolByAddress.get(from);
        if (!p) continue;

        const entry = byTx.get(log.transactionHash) || {};
        if (token === p.tokenAddress) {
          entry.type = "BUY";
          entry.rwaAmount = amount;
          entry.trader = to;
          entry.tokenAddress = p.tokenAddress;
        } else if (token === ACES_ADDRESS) {
          entry.acesAmount = amount;
        }
        entry.blockNumber = log.blockNumber;
        entry.timestamp = blockTimestamps.get(log.blockNumber) ?? 0;
        byTx.set(log.transactionHash, entry);
      }

      for (const log of toPoolLogs) {
        const token = log.address.toLowerCase();
        const from = parseTopic(log.topics[1]);
        const to = parseTopic(log.topics[2]);
        const amount = BigInt(log.data).toString();
        const p = poolByAddress.get(to);
        if (!p) continue;

        const entry = byTx.get(log.transactionHash) || {};
        if (token === p.tokenAddress) {
          entry.type = "SELL";
          entry.rwaAmount = amount;
          entry.trader = from;
          entry.tokenAddress = p.tokenAddress;
        } else if (token === ACES_ADDRESS) {
          entry.acesAmount = amount;
        }
        entry.blockNumber = log.blockNumber;
        entry.timestamp = blockTimestamps.get(log.blockNumber) ?? 0;
        byTx.set(log.transactionHash, entry);
      }

      // Build and insert trade records
      const trades = [];
      for (const [txHash, data] of byTx) {
        if (!data.type || !data.rwaAmount || !data.trader || !data.tokenAddress)
          continue;
        trades.push({
          txHash,
          tokenAddress: data.tokenAddress,
          tradeType: data.type,
          trader: data.trader,
          tokenAmount: data.rwaAmount,
          acesAmount: data.acesAmount ?? "0",
          blockNumber: parseInt(data.blockNumber || "0", 16),
          timestamp: data.timestamp ?? 0,
        });
      }

      if (trades.length > 0) {
        for (let i = 0; i < trades.length; i += 100) {
          await ctx.runMutation(internal.trades.insertBatch, {
            trades: trades.slice(i, i + 100),
          });
        }
        totalSwaps += trades.length;
      }

      // Save cursor after each successful chunk
      await ctx.runMutation(internal.trades.setSyncCursor, {
        key: backfillKey,
        blockNumber: chunkEnd,
      });

      // Pace to stay under Alchemy's 330 CU/s rate limit
      await new Promise((r) => setTimeout(r, BACKFILL_PACE_MS));
    }

    console.log(
      `backfillPool: ${symbol} complete — ${chunksProcessed} chunks, ${totalSwaps} trades found`,
    );
  },
});
