import { useState } from "react";
import { cn } from "~/lib/utils";
import { useOhlcv } from "~/hooks/use-ohlcv";
import { LightweightChart } from "./lightweight-chart";
import type { Timeframe } from "~/lib/gecko-terminal";

const TIMEFRAMES: Timeframe[] = ["1h", "4h", "1d"];

interface ChartSectionProps {
  tokenSymbol: string;
  isLive: boolean;
  tokenAddress?: string;
  geckoPoolAddress?: string;
}

export function ChartSection({
  tokenSymbol,
  isLive,
  tokenAddress,
  geckoPoolAddress,
}: ChartSectionProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const { candles, isLoading, hasPool, poolResolved } = useOhlcv(
    isLive ? tokenAddress : undefined,
    timeframe,
    geckoPoolAddress,
  );

  return (
    <div className="h-full flex flex-col rounded bg-card-surface glow-border-hover card-glow overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-golden-beige/8 px-5 py-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
          {tokenSymbol} / ACES
        </h3>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-medium uppercase transition-all",
                timeframe === tf
                  ? "bg-golden-beige/10 text-golden-beige"
                  : "text-platinum-grey/50 hover:text-platinum-grey/70",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      {/* Mobile/tablet: fixed height; desktop (xl+): grows to fill grid row, min 320px */}
      <div className="relative h-56 bg-deep-charcoal/50 xl:h-auto xl:flex-1 xl:min-h-80">
        {!isLive ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-platinum-grey/50">
              Chart available when trading is live
            </p>
          </div>
        ) : isLoading && candles.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-golden-beige/20 border-t-golden-beige/60" />
          </div>
        ) : poolResolved && !hasPool ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-platinum-grey/50">
              No pool data found for this token
            </p>
          </div>
        ) : candles.length === 0 && !isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-platinum-grey/50">
              No candle data available
            </p>
          </div>
        ) : (
          <LightweightChart candles={candles} />
        )}
      </div>
    </div>
  );
}
