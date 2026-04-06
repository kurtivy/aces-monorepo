import { cn } from "~/lib/utils";
import type { RwaTokenData } from "../../../convex/tokenData";

interface TokenHeaderProps {
  token: RwaTokenData;
  isLive: boolean;
}

export function TokenHeader({ token, isLive }: TokenHeaderProps) {
  return (
    <div className="rounded bg-card-surface glow-border-hover card-glow p-5 space-y-4">
      {/* Symbol + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-golden-beige/60">
            ${token.symbol}
          </span>
          <span className="text-platinum-grey/20">/</span>
          <span className="text-xs uppercase tracking-wider text-antique-bronze">
            {token.category}
          </span>
        </div>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-deep-emerald/20 px-3 py-1 text-xs font-medium text-deep-emerald border border-deep-emerald/30">
            <span className="h-1.5 w-1.5 rounded-full bg-deep-emerald animate-pulse" />
            Live
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-golden-beige/5 px-3 py-1 text-xs font-medium text-platinum-grey/75 border border-golden-beige/10">
            Coming Soon
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="font-heading text-2xl text-golden-beige leading-tight">
        {token.title}
      </h1>

    </div>
  );
}

/** Abbreviate percentages: below 1K show as-is, above 1K use K/M suffix */
function formatPct(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 1_000) return `${rounded}`;
  if (rounded < 1_000_000) return `${(rounded / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(rounded / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** Format a number as a full USD string with commas, no abbreviations */
function formatUsd(value: number): string {
  if (value <= 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Props for live metrics from Convex (populated by on-chain cron) */
interface LiveMetrics {
  tokenPriceUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  tradeRewardPct: number;
  eligibleSupply?: number;
  communityRewardUsd?: number;
}

export function TokenMetrics({
  token,
  liveMetrics,
  userBalance,
}: {
  token: RwaTokenData;
  liveMetrics?: LiveMetrics;
  /** Connected user's token balance (formatted, not raw bigint). Undefined = no wallet. */
  userBalance?: number;
}) {
  // Use live on-chain data when available, fall back to static placeholders
  const marketCap = liveMetrics ? formatUsd(liveMetrics.marketCapUsd) : (token.marketCap ?? "—");

  // Reward per Token = communityReward / eligibleSupply
  // Shows each token's current share of the reward pool as a dollar value.
  // Note: buying more tokens dilutes this — the value updates in real time.
  let rewardPerToken = "—";
  if (liveMetrics && liveMetrics.eligibleSupply && liveMetrics.eligibleSupply > 0 && liveMetrics.communityRewardUsd && liveMetrics.communityRewardUsd > 0) {
    const perToken = liveMetrics.communityRewardUsd / liveMetrics.eligibleSupply;
    rewardPerToken = formatUsd(perToken);
  }

  // Your Reward Share = (userBalance / eligibleSupply) x communityReward
  // Shows "—" when no wallet connected, "$0.00" when user holds no tokens
  let rewardEarned = "—";
  if (userBalance !== undefined && liveMetrics && liveMetrics.eligibleSupply && liveMetrics.eligibleSupply > 0 && liveMetrics.communityRewardUsd && liveMetrics.communityRewardUsd > 0) {
    const earned = (userBalance / liveMetrics.eligibleSupply) * liveMetrics.communityRewardUsd;
    rewardEarned = formatUsd(earned);
  } else if (userBalance !== undefined) {
    // Wallet connected but no community reward set or no eligible supply
    rewardEarned = "$0.00";
  }

  /* COMMUNITY REWARD metrics — reward distribution stats for the token */
  /* Aces Ratio and Volume (24H) disabled until meaningful data is available */
  const dataMetrics = [
    // { label: "Aces Ratio", value: token.acesRatio ?? "—" },
    /* Asset Value — total appraised value of the underlying real-world asset */
    { label: "Asset Value", value: token.value ?? "—" },
    /* Community Reward — total reward pool distributed to token holders */
    { label: "Community Reward", value: token.communityReward ?? "—" },
    /* Reward per Token — dollar value of reward per token at current eligible supply */
    { label: "Reward per Token", value: rewardPerToken },
    /* Your Reward Share — estimated reward payout for the connected wallet's balance */
    { label: "Your Reward Share", value: rewardEarned },
    // { label: "Volume (24H)", value: token.volume24h ?? "—" },
  ];

  /* STORY metrics — info about the underlying asset */
  const storyMetrics = [
    { label: "Brand", value: token.brand ?? "—" },
  ];

  return (
    <div className="space-y-4">
      {/* Market Cap — displayed prominently at the top */}
      <div className="flex items-center justify-between rounded bg-card-surface glow-border-hover card-glow px-4 py-3">
        <span className="text-[10px] uppercase tracking-wider text-antique-bronze">
          Market Cap
        </span>
        <span className="text-sm font-medium text-platinum-grey/90">
          {marketCap}
        </span>
      </div>

      {/* COMMUNITY REWARD section — asset value, reward pool, and per-wallet breakdown */}
      <div>
        <h3 className="mb-2 text-center font-heading text-xs uppercase tracking-widest text-golden-beige/70">
          Community Reward
        </h3>
        <div className="space-y-1">
          {dataMetrics.map((m) => (
            <div
              key={m.label}
              className="flex items-center justify-between rounded bg-card-surface glow-border-hover card-glow px-4 py-2"
            >
              <span className="text-[10px] uppercase tracking-wider text-antique-bronze">
                {m.label}
              </span>
              <span className="text-sm font-medium text-platinum-grey/80">
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* STORY section */}
      <div>
        <h3 className="mb-2 text-center font-heading text-xs uppercase tracking-widest text-golden-beige/70">
          Story
        </h3>
        <div className="space-y-1">
          {storyMetrics.map((m) => (
            <div
              key={m.label}
              className="flex items-center justify-between rounded bg-card-surface glow-border-hover card-glow px-4 py-2"
            >
              <span className="text-[10px] uppercase tracking-wider text-antique-bronze">
                {m.label}
              </span>
              <span className="text-sm font-medium text-platinum-grey/80">
                {m.value}
              </span>
            </div>
          ))}
          {/* Hype blurb — full-width narrative text */}
          {token.hype && (
            <div className="rounded bg-card-surface glow-border-hover card-glow px-4 py-3">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-antique-bronze">
                Hype
              </span>
              <p className="text-xs leading-relaxed text-platinum-grey/70">
                {token.hype}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
