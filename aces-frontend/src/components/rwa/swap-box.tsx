import { useState, useCallback, useMemo, useEffect } from "react";
import { useSwitchChain } from "wagmi";
import { cn, formatUsd } from "~/lib/utils";
import { useWallet } from "~/hooks/use-privy-wallet";
import { useTokenBalances } from "~/hooks/use-token-balances";
import { useDexQuote } from "~/hooks/use-dex-quote";
import { useSwapExecution } from "~/hooks/use-swap-execution";
import { WalletModal } from "~/components/wallet-modal";
import { CHAIN_ID } from "~/lib/contracts/addresses";
import type { SwapDirection, SwapPricing } from "~/lib/swap/types";
import { SWAP } from "~/lib/swap/constants";

interface SwapBoxProps {
  tokenSymbol: string;
  tokenAddress?: string;
  tokenDecimals?: number;
  /** Pre-configured Aerodrome pool info — skips on-chain discovery */
  dexPool?: { address: string; type: "v2" | "cl"; stable?: boolean; tickSpacing?: number };
  isLive: boolean;
  liveMetrics?: SwapPricing;
}

const PERCENTAGE_PRESETS = [25, 50, 75, 100] as const;

/** Parse raw viem/RPC errors into short user-friendly messages. */
function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit")) return "Network busy — please try again in a moment.";
  if (lower.includes("insufficient funds")) return "Insufficient funds for gas.";
  if (lower.includes("user rejected") || lower.includes("user denied"))
    return "Transaction rejected in wallet.";
  if (lower.includes("execution reverted")) return "Transaction would fail — try a smaller amount or higher slippage.";
  // Fallback: strip raw RPC data but keep the human-readable prefix
  const cleaned = raw.replace(/\s*Raw Call Arguments:[\s\S]*/, "").trim();
  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned;
}

function formatSwapAmount(value: string | number, maxFractionDigits = 6) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(num);
}

export function SwapBox({
  tokenSymbol,
  tokenAddress,
  tokenDecimals = 18,
  dexPool,
  isLive,
  liveMetrics,
}: SwapBoxProps) {
  const { isConnected, chainId, status } = useWallet();
  const { switchChain } = useSwitchChain();
  const { balances, refetch: refetchBalances } = useTokenBalances(tokenAddress, tokenDecimals);

  const [direction, setDirection] = useState<SwapDirection>("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(SWAP.DEFAULT_SLIPPAGE_BPS);
  const [showSlippage, setShowSlippage] = useState(false);

  const isBuy = direction === "buy";
  const inputSymbol = isBuy ? "ACES" : tokenSymbol;
  const outputSymbol = isBuy ? tokenSymbol : "ACES";
  const balance = isBuy ? balances.ACES : balances.TOKEN;

  const swap = useSwapExecution();

  const displayAmount = useMemo(() => {
    if (!amount) return "";
    const [whole, dec] = amount.split(".");
    if (whole === "") {
      return dec !== undefined ? `0.${dec}` : "";
    }
    const parsedWhole = parseInt(whole, 10);
    if (isNaN(parsedWhole)) return "";
    const formatted = parsedWhole.toLocaleString("en-US");
    return dec !== undefined ? `${formatted}.${dec}` : formatted;
  }, [amount]);

  const handleAmountChange = useCallback((raw: string) => {
    const stripped = raw.replace(/,/g, "");
    if (stripped === "" || /^\d*\.?\d*$/.test(stripped)) {
      setAmount(stripped);
      if (swap.error || swap.txHash) swap.reset();
    }
  }, [swap]);

  const handleDirectionChange = useCallback((nextDirection: SwapDirection) => {
    if (nextDirection === direction) return;
    setDirection(nextDirection);
    setAmount("");
    if (swap.error || swap.txHash || swap.status) swap.reset();
  }, [direction, swap]);

  const handlePercentage = useCallback(
    (pct: number) => {
      const bal = parseFloat(balance);
      if (!Number.isFinite(bal) || bal <= 0) return;
      setAmount(((bal * pct) / 100).toString());
      if (swap.error || swap.txHash) swap.reset();
    },
    [balance, swap],
  );

  const {
    estimatedOutput,
    swapRoute,
    isLoading: quoteLoading,
    isRefreshing: quoteRefreshing,
    isUnavailable,
    quoteError,
    refreshQuote,
  } = useDexQuote({
    tokenAddress,
    tokenDecimals,
    dexPool,
    amount,
    direction,
  });

  const parsedAmount = parseFloat(amount);
  const parsedBalance = parseFloat(balance);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const hasSufficientBalance =
    !hasValidAmount || (Number.isFinite(parsedBalance) && parsedAmount <= parsedBalance);
  const isWrongNetwork =
    status === "connected" &&
    typeof chainId === "number" &&
    chainId !== CHAIN_ID;

  // Auto-switch to Base when wagmi reports a wrong chain (common on reconnect
  // where wagmi's cached chainId is stale but the wallet is already on Base)
  useEffect(() => {
    if (isWrongNetwork) {
      switchChain({ chainId: CHAIN_ID });
    }
  }, [isWrongNetwork, switchChain]);

  const inputUsdValue = useMemo(() => {
    if (!hasValidAmount) return null;
    const price = isBuy ? liveMetrics?.acesPriceUsd : liveMetrics?.tokenPriceUsd;
    if (!price || price <= 0) return null;
    return parsedAmount * price;
  }, [hasValidAmount, isBuy, liveMetrics, parsedAmount]);

  const estimatedOutputUsdValue = useMemo(() => {
    const parsedOutput = parseFloat(estimatedOutput);
    if (!Number.isFinite(parsedOutput) || parsedOutput <= 0) return null;
    const price = isBuy ? liveMetrics?.tokenPriceUsd : liveMetrics?.acesPriceUsd;
    if (!price || price <= 0) return null;
    return parsedOutput * price;
  }, [estimatedOutput, isBuy, liveMetrics]);

  const handleSwap = useCallback(async () => {
    if (!swapRoute || !hasSufficientBalance || quoteLoading || quoteRefreshing || isUnavailable) {
      return;
    }

    const freshRoute = await refreshQuote();
    if (!freshRoute) return;

    const result = await swap.execute({
      route: freshRoute,
      slippageBps,
    });

    if (result.success) {
      setAmount("");
      await refetchBalances();
    }
  }, [
    swapRoute,
    hasSufficientBalance,
    quoteLoading,
    quoteRefreshing,
    isUnavailable,
    refreshQuote,
    swap,
    slippageBps,
    refetchBalances,
  ]);

  const showDefaultSlippageButton = !SWAP.SLIPPAGE_PRESETS.some(
    (bps) => bps === SWAP.DEFAULT_SLIPPAGE_BPS,
  );

  const swapDisabled =
    !hasValidAmount ||
    !swapRoute ||
    quoteLoading ||
    quoteRefreshing ||
    isUnavailable ||
    swap.isExecuting ||
    !hasSufficientBalance ||
    isWrongNetwork;

  return (
    <div className="rounded bg-card-surface glow-border-hover card-glow overflow-hidden">
      <div className="flex border-b border-golden-beige/8">
        <button
          onClick={() => handleDirectionChange("buy")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            isBuy
              ? "text-deep-emerald bg-deep-emerald/5 border-b-2 border-deep-emerald"
              : "text-platinum-grey/75 hover:text-platinum-grey/75",
          )}
        >
          Buy
        </button>
        <button
          onClick={() => handleDirectionChange("sell")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            !isBuy
              ? "text-red-400 bg-red-400/5 border-b-2 border-red-400"
              : "text-platinum-grey/75 hover:text-platinum-grey/75",
          )}
        >
          Sell
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-golden-beige/8 bg-deep-charcoal px-3 py-2.5">
            <span className="block text-[10px] uppercase tracking-wider text-platinum-grey/50">
              {isBuy ? "Pay with" : "Sell"}
            </span>
            <span className="mt-1 block text-sm font-medium text-platinum-grey/85">
              {inputSymbol}
            </span>
          </div>
          <div className="rounded border border-golden-beige/8 bg-deep-charcoal px-3 py-2.5">
            <span className="block text-[10px] uppercase tracking-wider text-platinum-grey/50">
              Receive
            </span>
            <span className="mt-1 block text-sm font-medium text-platinum-grey/85">
              {outputSymbol}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-platinum-grey/50">
              {`Amount (${inputSymbol})`}
            </label>
            <span className="text-[10px] text-platinum-grey/50">
              Balance: {formatSwapAmount(balance, 0)}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={displayAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              disabled={swap.isExecuting}
              className={cn(
                "w-full rounded border border-golden-beige/10 bg-deep-charcoal px-4 py-3 text-lg text-platinum-grey/90",
                "placeholder:text-platinum-grey/20 focus:border-golden-beige/30 focus:outline-none focus:ring-1 focus:ring-golden-beige/10",
                swap.isExecuting && "cursor-not-allowed opacity-50",
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-platinum-grey/50">
              {inputSymbol}
            </span>
          </div>
          {(inputUsdValue !== null || (hasValidAmount && !hasSufficientBalance)) && (
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-platinum-grey/45">
                {inputUsdValue !== null ? `Approx. ${formatUsd(inputUsdValue)}` : ""}
              </span>
              {!hasSufficientBalance && (
                <span className="text-red-400">Insufficient {inputSymbol} balance</span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {PERCENTAGE_PRESETS.map((pct) => (
            <button
              key={pct}
              onClick={() => handlePercentage(pct)}
              disabled={swap.isExecuting}
              className="flex-1 rounded-sm border border-golden-beige/8 py-1.5 text-xs text-platinum-grey/75 transition-all hover:border-golden-beige/20 hover:text-platinum-grey/75 disabled:opacity-50"
            >
              {pct}%
            </button>
          ))}
        </div>

        <div className="rounded border border-golden-beige/8 bg-golden-beige/5 px-4 py-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-platinum-grey/50">
              Estimated output
            </span>
            <span className="text-[10px] text-platinum-grey/40">
              Balance: {formatSwapAmount(isBuy ? balances.TOKEN : balances.ACES, 0)}
            </span>
          </div>
          {isUnavailable && hasValidAmount ? (
            <span className="text-sm text-red-400/80">
              {quoteError ?? "Direct ACES pool quote unavailable"}
            </span>
          ) : quoteLoading && hasValidAmount ? (
            <span className="text-sm text-platinum-grey/75 animate-pulse">
              Fetching quote...
            </span>
          ) : quoteRefreshing && hasValidAmount ? (
            <span className="text-sm text-platinum-grey/75 animate-pulse">
              Refreshing quote...
            </span>
          ) : hasValidAmount && estimatedOutput ? (
            <div className="space-y-1">
              <span className="block text-lg font-medium text-golden-beige">
                {formatSwapAmount(estimatedOutput)}{" "}
                <span className="text-sm text-golden-beige/60">
                  {outputSymbol}
                </span>
              </span>
              {estimatedOutputUsdValue !== null && (
                <span className="block text-[11px] text-platinum-grey/55">
                  Approx. {formatUsd(estimatedOutputUsdValue)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-platinum-grey/25">
              —
            </span>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowSlippage(!showSlippage)}
            className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-platinum-grey/50 transition-colors hover:text-platinum-grey/70"
          >
            Slippage: {(slippageBps / 100).toFixed(1)}%
            <svg
              className={cn(
                "h-3 w-3 transition-transform",
                showSlippage && "rotate-180",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {showSlippage && (
            <div className="mt-2 flex gap-2">
              {SWAP.SLIPPAGE_PRESETS.map((bps) => (
                <button
                  key={bps}
                  onClick={() => setSlippageBps(bps)}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-xs transition-all",
                    slippageBps === bps
                      ? "bg-golden-beige/10 text-golden-beige border border-golden-beige/20"
                      : "text-platinum-grey/75 border border-golden-beige/8 hover:border-golden-beige/20",
                  )}
                >
                  {(bps / 100).toFixed(1)}%
                </button>
              ))}
              {showDefaultSlippageButton && (
                <button
                  onClick={() => setSlippageBps(SWAP.DEFAULT_SLIPPAGE_BPS)}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-xs transition-all",
                    slippageBps === SWAP.DEFAULT_SLIPPAGE_BPS
                      ? "bg-golden-beige/10 text-golden-beige border border-golden-beige/20"
                      : "text-platinum-grey/75 border border-golden-beige/8 hover:border-golden-beige/20",
                  )}
                >
                  {(SWAP.DEFAULT_SLIPPAGE_BPS / 100).toFixed(0)}%
                </button>
              )}
            </div>
          )}
        </div>

        {swap.status && (
          <div className="rounded border border-golden-beige/10 bg-golden-beige/5 px-4 py-2.5">
            <span className="text-xs text-golden-beige animate-pulse">
              {swap.status}
            </span>
          </div>
        )}
        {swap.error && (
          <div className="overflow-hidden rounded border border-red-400/20 bg-red-400/5 px-4 py-2.5">
            <span className="block break-all text-xs text-red-400 line-clamp-3">
              {friendlyError(swap.error)}
            </span>
          </div>
        )}
        {swap.txHash && (
          <div className="rounded border border-deep-emerald/20 bg-deep-emerald/5 px-4 py-2.5">
            <span className="text-xs text-deep-emerald">
              Success!{" "}
              <a
                href={`https://basescan.org/tx/${swap.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-golden-beige"
              >
                View on Basescan
              </a>
            </span>
          </div>
        )}

        {!isConnected ? (
          <WalletModal>
            <button
              className="w-full rounded border border-golden-beige/30 py-3.5 text-sm font-medium text-golden-beige transition-all hover:border-golden-beige/60 hover:shadow-gold-glow"
            >
              Connect Wallet
            </button>
          </WalletModal>
        ) : isWrongNetwork ? (
          /* Wallet is on a non-Base chain — prompt user to switch */
          <button
            onClick={() => switchChain({ chainId: CHAIN_ID })}
            className="w-full rounded border border-golden-beige/30 py-3.5 text-sm font-semibold text-golden-beige transition-all hover:border-golden-beige/60 hover:shadow-gold-glow"
          >
            Switch to Base
          </button>
        ) : !isLive ? (
          <button
            disabled
            className="w-full rounded bg-golden-beige/5 py-3.5 text-sm font-medium text-platinum-grey/50 cursor-not-allowed"
          >
            Coming Soon
          </button>
        ) : (
          <button
            disabled={swapDisabled}
            onClick={handleSwap}
            className={cn(
              "w-full rounded py-3.5 text-sm font-semibold transition-all min-h-[44px]",
              isBuy
                ? "bg-deep-emerald text-golden-beige hover:shadow-emerald-glow hover:shadow-[0_0_30px_rgba(24,77,55,0.5)] disabled:bg-deep-emerald/30 disabled:text-golden-beige/30"
                : "bg-red-500/80 text-white hover:bg-red-500 disabled:bg-red-500/20 disabled:text-white/30",
              swapDisabled && "cursor-not-allowed",
            )}
          >
            {swap.isExecuting
              ? "Processing..."
              : quoteLoading || quoteRefreshing
                ? "Refreshing quote..."
              : !hasSufficientBalance && hasValidAmount
                ? `Insufficient ${inputSymbol}`
                : isBuy
                  ? `Buy ${tokenSymbol}`
                  : `Sell ${tokenSymbol}`}
          </button>
        )}
      </div>
    </div>
  );
}
