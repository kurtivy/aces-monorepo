import { useMemo, useState, useEffect } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn, truncateAddress } from "~/lib/utils";
import { formatUnits } from "viem";
import { ChevronLeft, ChevronRight, ExternalLink, Info } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────

/** Formats a unix timestamp into a human-readable relative time string */
function timeAgo(timestamp: number): string {
  const diff = Date.now() / 1000 - timestamp;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Formats a raw bigint string (18 decimals) into a full display number, no decimals */
function formatTokenAmount(raw: string): string {
  return Math.floor(
    parseFloat(formatUnits(BigInt(raw), 18)),
  ).toLocaleString("en-US");
}

// ── Component ────────────────────────────────────────────────

/**
 * Paginated trade history for a single token.
 *
 * Uses Convex's usePaginatedQuery under the hood but presents a
 * traditional prev/next page UI. Data is fetched in batches of
 * pageSize * 5 so most page navigations are instant. When the user
 * reaches the last page of loaded data, the next batch is prefetched
 * automatically so there's no visible loading delay.
 */
export function TradeHistory({
  tokenSymbol,
  tokenAddress,
  pageSize = 10,
}: {
  tokenSymbol: string;
  /** Contract address — if undefined (upcoming token), shows empty state */
  tokenAddress?: string;
  /** Number of trades to display per page (default 10). Batch fetch
   *  size is automatically set to pageSize * 5 for smooth navigation. */
  pageSize?: number;
}) {
  const [currentPage, setCurrentPage] = useState(0);

  /**
   * Batch size = 5x the page size.
   * e.g. pageSize=10 → fetch 50 at a time, pageSize=100 → fetch 500.
   * This keeps the first 5 page transitions instant before a new
   * fetch is needed.
   */
  const batchSize = pageSize * 5;

  // Subscribe to paginated trades via Convex websocket.
  // usePaginatedQuery accumulates results as loadMore() is called,
  // and automatically pushes new trades via websocket.
  const { results, status, loadMore } = usePaginatedQuery(
    api.trades.byToken,
    tokenAddress ? { tokenAddress } : "skip",
    { initialNumItems: batchSize },
  );

  // ── Derived pagination state ──────────────────────────────

  /** Total number of pages available from currently loaded data */
  const totalLoadedPages = Math.ceil(results.length / pageSize);

  /** Whether more data can be fetched from the server */
  const canLoadMore = status === "CanLoadMore";

  /** Whether the server has no more data beyond what's loaded */
  const isExhausted = status === "Exhausted";

  /** Whether the user can go forward — either more loaded pages
   *  or more data on the server to fetch */
  const hasNextPage =
    currentPage < totalLoadedPages - 1 || canLoadMore;

  /** Slice the loaded results to the current page window */
  const pageStart = currentPage * pageSize;
  const visibleTrades = useMemo(
    () => results.slice(pageStart, pageStart + pageSize),
    [results, pageStart, pageSize],
  );

  /**
   * Prefetch trigger: when the user is on the last page of loaded
   * data (or within one page of it), eagerly load the next batch so
   * the "next" click is instant. For example, with pageSize=10 and
   * batchSize=50, this fires on page 4 (the 5th page, 0-indexed)
   * and fetches trades 51–100 in the background.
   */
  useEffect(() => {
    const isOnLastLoadedPage = currentPage >= totalLoadedPages - 1;
    if (isOnLastLoadedPage && canLoadMore) {
      loadMore(batchSize);
    }
  }, [currentPage, totalLoadedPages, canLoadMore, loadMore, batchSize]);

  // ── Handlers ────────────────────────────────────────────────

  const goNext = () => {
    if (hasNextPage) setCurrentPage((p) => p + 1);
  };

  const goPrev = () => {
    if (currentPage > 0) setCurrentPage((p) => p - 1);
  };

  // ── Loading state — first page hasn't resolved yet ────────

  const isFirstLoad = status === "LoadingFirstPage";

  return (
    <div className="rounded bg-card-surface glow-border-hover card-glow overflow-hidden">
      {/* Header with info tooltip indicating the sync interval */}
      <div className="px-5 py-3 border-b border-golden-beige/8 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
          Recent Trades
        </h3>
        {/* Tooltip positioned downward — the card has overflow-hidden so
            upward tooltips get clipped. Downward stays within bounds. */}
        <div className="relative group">
          <Info className="h-3.5 w-3.5 text-platinum-grey/30 hover:text-platinum-grey/60 transition-colors cursor-help" />
          <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-10">
            <div className="bg-[#1a1a1a] border border-golden-beige/10 rounded px-2.5 py-1.5 text-[10px] text-platinum-grey/60 whitespace-nowrap shadow-lg">
              Updates every 3 minutes
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isFirstLoad && (
        <div className="px-5 py-8 text-center text-xs text-platinum-grey/40">
          Loading trades…
        </div>
      )}

      {/* Empty state — query resolved but no trades exist */}
      {!isFirstLoad && results.length === 0 && (
        <div className="px-5 py-8 text-center text-xs text-platinum-grey/40">
          No trades yet
        </div>
      )}

      {/* Trade rows — stacked cards on mobile, table row on md+ */}
      {!isFirstLoad && visibleTrades.length > 0 && (
        <div className="divide-y divide-golden-beige/5">
          {/* Column headers — desktop only. Each visual element has its own column. */}
          <div className="hidden sm:flex items-center gap-0 px-5 py-2 text-[10px] font-medium uppercase tracking-wider text-platinum-grey/40">
            <span className="w-11 shrink-0" />
            <span className="flex-1 text-right pr-1.5">Spent</span>
            <span className="w-16 shrink-0" />
            <span className="w-5 shrink-0" />
            <span className="flex-1 text-right pr-1.5">Received</span>
            <span className="w-16 shrink-0" />
            <span className="w-10 shrink-0" />
            <span className="w-14 shrink-0 text-right">Time</span>
          </div>

          {visibleTrades.map((trade) => {
            /* Determine spent/received based on trade direction:
               BUY  = trader spends ACES, receives the token
               SELL = trader spends the token, receives ACES */
            const spentAmount =
              trade.tradeType === "BUY" ? trade.acesAmount : trade.tokenAmount;
            const spentSymbol =
              trade.tradeType === "BUY" ? "ACES" : tokenSymbol;
            const receivedAmount =
              trade.tradeType === "BUY" ? trade.tokenAmount : trade.acesAmount;
            const receivedSymbol =
              trade.tradeType === "BUY" ? tokenSymbol : "ACES";

            const badgeEl = (
              <span
                className={cn(
                  "inline-flex h-5 w-11 shrink-0 items-center justify-center rounded text-[10px] font-medium uppercase",
                  trade.tradeType === "BUY"
                    ? "bg-deep-emerald/20 text-deep-emerald"
                    : "bg-red-500/10 text-red-400",
                )}
              >
                {trade.tradeType}
              </span>
            );

            return (
              <div key={trade._id}>
                {/* ── Mobile layout (<sm): two-row card ── */}
                <div className="sm:hidden px-5 py-2.5 space-y-1.5 hover:bg-golden-beige/3 transition-colors">
                  {/* Row 1: badge left, time right */}
                  <div className="flex items-center justify-between">
                    {badgeEl}
                    <span className="text-[10px] text-platinum-grey/25">{timeAgo(trade.timestamp)}</span>
                  </div>
                  {/* Row 2: amounts left, View Tx right */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-platinum-grey/80">
                      <span className="tabular-nums">{formatTokenAmount(spentAmount)}</span>
                      <span className="text-platinum-grey/60"> {spentSymbol}</span>
                      <span className="text-platinum-grey/30"> → </span>
                      <span className="tabular-nums">{formatTokenAmount(receivedAmount)}</span>
                      <span className="text-platinum-grey/60"> {receivedSymbol}</span>
                    </span>
                    <a
                      href={`https://basescan.org/tx/${trade.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-platinum-grey/40 hover:text-golden-beige transition-colors shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {/* ── Desktop layout (sm+): fixed-width columns for alignment ── */}
                <div className="hidden sm:flex items-center gap-0 px-5 py-2.5 hover:bg-golden-beige/3 transition-colors">
                  {badgeEl}
                  <span className="flex-1 text-right whitespace-nowrap text-sm text-platinum-grey/80 tabular-nums pr-1.5">{formatTokenAmount(spentAmount)}</span>
                  <span className="w-16 shrink-0 text-sm text-platinum-grey/60">{spentSymbol}</span>
                  <span className="text-platinum-grey/30 text-xs w-5 text-center shrink-0">→</span>
                  <span className="flex-1 text-right whitespace-nowrap text-sm text-platinum-grey/80 tabular-nums pr-1.5">{formatTokenAmount(receivedAmount)}</span>
                  <span className="w-16 shrink-0 text-sm text-platinum-grey/60">{receivedSymbol}</span>
                  <a
                    href={`https://basescan.org/tx/${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 w-10 justify-center text-[10px] text-platinum-grey/40 hover:text-golden-beige transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-[10px] text-platinum-grey/25 whitespace-nowrap w-14 text-right">{timeAgo(trade.timestamp)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls — only shown when trades exist */}
      {!isFirstLoad && results.length > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-golden-beige/8">
          {/* Previous button */}
          <button
            onClick={goPrev}
            disabled={currentPage === 0}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors cursor-pointer",
              currentPage === 0
                ? "text-platinum-grey/20 cursor-not-allowed"
                : "text-platinum-grey/60 hover:text-platinum-grey/90",
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>

          {/* Page indicator — shows current page number.
              If the server has more data, we can't show a total,
              so we display "Page N" or "Page N of M" when exhausted. */}
          <span className="text-[10px] text-platinum-grey/30">
            Page {currentPage + 1}
            {isExhausted && totalLoadedPages > 0 &&
              ` of ${totalLoadedPages}`}
          </span>

          {/* Next button */}
          <button
            onClick={goNext}
            disabled={!hasNextPage}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors cursor-pointer",
              !hasNextPage
                ? "text-platinum-grey/20 cursor-not-allowed"
                : "text-platinum-grey/60 hover:text-platinum-grey/90",
            )}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
