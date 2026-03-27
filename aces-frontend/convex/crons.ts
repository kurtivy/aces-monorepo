/**
 * Convex cron jobs.
 *
 * The real-time trade listener runs continuously via a 9-minute restart
 * cycle. The original tradeSyncer (eth_getLogs poller) is kept as a
 * backup safety net on a 5-minute interval to catch any trades the
 * WebSocket listener might miss (e.g. during restarts or WS disconnects).
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/** Real-time trade listener — restarts every 9 min to stay within action timeout */
crons.interval(
  "real-time trade listener",
  { minutes: 9 },
  internal.tradeListener.listen,
);

/** Backup sync — catches any trades missed by the WebSocket listener */
crons.interval(
  "backup trade sync (safety net)",
  { minutes: 5 },
  internal.tradeSyncer.syncTrades,
);

/** Fetch on-chain metrics (supply, reserves, prices) for all live RWA tokens */
crons.interval(
  "fetch on-chain token metrics",
  { minutes: 1 },
  internal.onchainMetrics.fetchAndSave,
);

/** Prune trades beyond 5000 per token */
crons.interval(
  "prune old trades",
  { hours: 1 },
  internal.trades.pruneAllTokens,
);

export default crons;
