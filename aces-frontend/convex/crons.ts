/**
 * Convex cron jobs.
 * Each cron triggers an internal action on a fixed interval.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/** Fetch on-chain metrics (supply, reserves, prices) for all live RWA tokens */
crons.interval(
  "fetch on-chain token metrics",
  { minutes: 1 },
  internal.onchainMetrics.fetchAndSave,
);

/** Sync Trade events from Aerodrome pools via eth_getLogs */
crons.interval(
  "sync trade events from chain",
  { minutes: 3 },
  internal.tradeSyncer.syncTrades,
);

/** Prune trades beyond 5000 per token */
crons.interval(
  "prune old trades",
  { hours: 1 },
  internal.trades.pruneAllTokens,
);

export default crons;
