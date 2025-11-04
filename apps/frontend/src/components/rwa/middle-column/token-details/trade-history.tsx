'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';

// 🚀 PHASE 5: Migrated to WebSocket-powered hook
import { useTradeHistory, type TradeHistoryEntry } from '@/hooks/rwa/use-trade-history-websocket';
import { useAcesUsdPrice } from '@/hooks/use-aces-usd-price';
import { cn } from '@/lib/utils';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface TradeHistoryProps {
  tokenAddress: string;
  tokenSymbol?: string;
  dexMeta?: DatabaseListing['dex'] | null;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

const parseMaybeNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const;

const toSubscript = (value: number) =>
  String(value)
    .split('')
    .map((char) => {
      const digit = Number.parseInt(char, 10);
      return Number.isNaN(digit) ? char : (SUBSCRIPT_DIGITS[digit] ?? char);
    })
    .join('');

const zeroCountFormat = (value: number, tailDigits = 2): string => {
  if (!Number.isFinite(value)) return String(value);
  const sign = value < 0 ? '-' : '';
  const absValue = Math.abs(value);

  if (absValue === 0) return '0';
  if (absValue >= 1e-2) return sign + absValue.toString();

  const exponent = Math.floor(Math.log10(absValue));
  const zeroCount = Math.abs(exponent) - 1;
  const scaled = absValue * Math.pow(10, zeroCount + 1);

  const digits = scaled
    .toPrecision(tailDigits + 1)
    .replace(/\./g, '')
    .replace(/^0+/, '');

  const tail = digits.padEnd(tailDigits, '0').slice(0, tailDigits);

  return `${sign}0.0${toSubscript(zeroCount)}${tail}`;
};

export default function TradeHistory({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  dexMeta,
  className,
  contentClassName,
  style,
  onToggleExpand,
  isExpanded = false,
}: TradeHistoryProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { trades, isLoading, error } = useTradeHistory(tokenAddress, { dexMeta });

  const { acesUsdPrice } = useAcesUsdPrice({ enabled: true });
  const acesUsd = acesUsdPrice ? Number.parseFloat(acesUsdPrice) : null;

  const safeTrades: TradeHistoryEntry[] = Array.isArray(trades) ? trades : [];

  const normalizeAmount = (amount: string): number => {
    if (!amount) return 0;
    const hasDecimal = amount.includes('.') || amount.includes('e') || amount.includes('E');
    const numeric = Number(amount);

    if (hasDecimal) {
      return Number.isFinite(numeric) ? numeric : 0;
    }

    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return numeric / 1e18;
  };

  const formatAmount = (amount: string, fractionDigits = 4) => {
    const value = normalizeAmount(amount);

    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    if (value === 0) return '0.0000';
    return value.toFixed(fractionDigits);
  };

  const formatAcesAmount = (amount: string) => {
    const value = normalizeAmount(amount);
    if (value > 0 && value < 0.01) return '< 0.01';
    return formatAmount(amount, 4);
  };

  const formatTokenAmount = (amount: string) => {
    const value = normalizeAmount(amount);
    if (value > 0 && value < 0.01) return '< 0.01';
    return formatAmount(amount, 2);
  };

  const formatWalletAddress = (address?: string) => {
    if (!address) return '--';
    const prefix = address.slice(0, 7);
    const suffix = address.slice(-4);
    return `${prefix}…${suffix}`;
  };

  const formatWalletAddressMobile = (address?: string) => {
    if (!address) return '--';
    const prefix = address.slice(0, 5);
    return `${prefix}…`;
  };

  const formatTxHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const tradeTime = timestamp;
    if (!Number.isFinite(tradeTime)) return '--';
    const diffMs = now - tradeTime;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getAddressUrl = (address: string) => `https://basescan.org/address/${address}`;

  const getTxUrl = (hash: string) => `https://basescan.org/tx/${hash}`;

  const containerClasses = cn(
    'relative bg-[#151c16] rounded-xl overflow-hidden mt-0 flex flex-col',
    className,
  );
  const contentClasses = cn('flex flex-col flex-1', contentClassName);

  const formatUsd = (value: number | null | undefined, options?: { isBuy?: boolean }) => {
    if (value == null || !Number.isFinite(value)) return '--';
    const abs = Math.abs(value);
    if (abs > 0 && abs < 0.01) return '< $0.01';
    if (options?.isBuy) return `$${value.toFixed(2)}`;
    return value < 10 ? `$${value.toFixed(6)}` : `$${value.toFixed(2)}`;
  };

  const formatUnitPrice = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '--';
    const absValue = Math.abs(value);
    if (absValue < 1e-2) {
      return `$${zeroCountFormat(value, 2)}`;
    }
    return `$${value.toFixed(6)}`;
  };

  let mainContent: ReactNode = null;

  if (!isClient) {
    mainContent = (
      <div className="flex flex-1 items-center justify-center text-gray-400">Loading...</div>
    );
  } else if (isLoading && safeTrades.length === 0) {
    mainContent = (
      <div className="flex-1 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg bg-black/50 p-3 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-gray-600" />
              <div className="h-4 w-20 rounded bg-gray-600" />
            </div>
            <div className="h-4 w-12 rounded bg-gray-600" />
            <div className="h-4 w-16 rounded bg-gray-600" />
            <div className="h-4 w-12 rounded bg-gray-600" />
            <div className="h-4 w-16 rounded bg-gray-600" />
          </div>
        ))}
      </div>
    );
  } else if (error) {
    mainContent = (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <div className="text-red-400 text-base font-semibold">Error loading trades</div>
        <div className="text-sm text-gray-400">{String(error)}</div>
      </div>
    );
  } else if (safeTrades.length === 0) {
    mainContent = (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <div className="text-[#D0B284] text-base font-semibold">No trades yet for this token</div>
        <div className="text-sm text-gray-400">Trades will appear here as they happen</div>
      </div>
    );
  } else {
    mainContent = (
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        <div className="hidden md:flex md:flex-1 md:flex-col overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[#151c16]">
                <tr className="border-b-2 border-[#284c33]">
                  <th className="px-3 py-0.5 text-left text-[11px] font-semibold tracking-wide text-[#DCDDCC]">
                    DATE
                  </th>
                  <th className="px-3 py-0.5 text-left text-[11px] font-semibold tracking-wide text-[#DCDDCC]">
                    TYPE
                  </th>
                  <th className="px-3 py-0.5 text-right text-[11px] font-semibold tracking-wide text-[#DCDDCC]">
                    USD
                  </th>
                  <th className="px-3 py-0.5 text-right text-[11px] font-semibold tracking-wide text-[#DCDDCC]">
                    ACES
                  </th>
                  <th className="px-3 py-0.5 text-right text-[11px] font-semibold tracking-wide text-[#DCDDCC]">
                    {tokenSymbol}
                  </th>
                  <th className="px-3 py-0.5 text-right text-[11px] font-semibold tracking-wide text-[#DCDDCC]">
                    PRICE
                  </th>
                  <th className="px-3 py-0.5 text-left text-[11px] font-semibold tracking-wide text-[#DCDDCC]">
                    MAKER
                  </th>
                  <th className="px-3 py-0.5 text-center text-[11px] font-semibold tracking-wide text-[#DCDDCC]">
                    <div className="flex items-center justify-between gap-2">
                      <span>TXN</span>
                      {onToggleExpand && (
                        <button
                          type="button"
                          onClick={onToggleExpand}
                          aria-label={isExpanded ? 'Collapse widget' : 'Expand widget'}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#D0B284]/40 text-[#D0B284] hover:bg-[#D0B284]/10 focus:outline-none focus:ring-1 focus:ring-[#D0B284]/40"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronUp className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {safeTrades.map((trade, index) => {
                  const isBuy = trade.direction === 'buy';
                  const accent = isBuy ? 'text-[#37d488]' : 'text-[#f87171]';
                  const isHighlighted = index < 3;
                  const alternatingBg = index % 2 === 0 ? 'bg-[#112118]' : 'bg-[#0d1a12]';

                  const actorLabel = trade.trader
                    ? formatWalletAddress(trade.trader)
                    : 'Aerodrome LP';
                  const actorLink = trade.trader ? getAddressUrl(trade.trader) : null;

                  const txHash = trade.txHash ?? trade.id;
                  const txLink = getTxUrl(txHash);

                  const acesAmt = normalizeAmount(trade.counterAmount);
                  const tokenAmt = normalizeAmount(trade.tokenAmount);

                  const usdFromTrade = parseMaybeNumber(trade.totalUsd);
                  const usdVal = usdFromTrade ?? (acesUsd != null ? acesAmt * acesUsd : null);

                  // 🔥 NEW: Priority 1 - Use marginal price from backend (most accurate for bonding curve)
                  const marginalPriceAces = trade.marginalPriceInAces
                    ? parseFloat(trade.marginalPriceInAces)
                    : null;
                  const marginalPriceUsd =
                    marginalPriceAces != null && acesUsd != null ? marginalPriceAces * acesUsd : null;

                  const priceFromTradeUsd = parseMaybeNumber(trade.priceUsd);
                  const priceFromCounter =
                    trade.priceInCounter && Number.isFinite(trade.priceInCounter) && acesUsd != null
                      ? trade.priceInCounter * acesUsd
                      : null;
                  const unitPrice =
                    marginalPriceUsd ?? // 🔥 Priority 1: Marginal price (bonding curve)
                    priceFromTradeUsd ?? // Priority 2: DEX price in USD
                    (priceFromCounter && priceFromCounter > 0 ? priceFromCounter : null) ?? // Priority 3: Price from counter
                    (usdVal != null && tokenAmt > 0 ? usdVal / tokenAmt : null); // Priority 4: Fallback average price

                  return (
                    <tr
                      key={trade.id}
                      className={cn(
                        'border-b border-[#2a3b2a]/40 hover:bg-[#12281c] transition-colors',
                        alternatingBg,
                        isHighlighted && 'bg-[#184D37]/15',
                      )}
                    >
                      <td className="px-3 py-2 align-middle">
                        <span className="text-[13px] text-gray-400">
                          {formatRelativeTime(trade.timestamp)}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className={cn('text-[13px] font-medium', accent)}>
                          {isBuy ? 'Buy' : 'Sell'}
                        </span>
                      </td>
                      <td className={cn('px-3 py-2 text-right align-middle font-mono', accent)}>
                        {formatUsd(usdVal, { isBuy })}
                      </td>
                      <td className={cn('px-3 py-2 text-right align-middle font-mono', accent)}>
                        {formatAcesAmount(trade.counterAmount)}
                      </td>
                      <td className={cn('px-3 py-2 text-right align-middle font-mono', accent)}>
                        {formatTokenAmount(trade.tokenAmount)}
                      </td>
                      <td className={cn('px-3 py-2 text-right align-middle font-mono', accent)}>
                        {formatUnitPrice(unitPrice)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {actorLink ? (
                          <a
                            href={actorLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-white hover:text-[#D0B284] transition-colors"
                          >
                            <span className="font-mono text-[13px]">{actorLabel}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="font-mono text-[13px] text-white">{actorLabel}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <a
                          href={txLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mx-auto flex w-fit items-center gap-1 text-white hover:text-[#D0B284] transition-colors"
                        >
                          <span className="font-mono text-[13px]">{formatTxHash(txHash)}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden">
          <div className="space-y-2 px-3 pb-3">
            {safeTrades.map((trade, index) => {
              const isBuy = trade.direction === 'buy';
              const accent = isBuy ? 'text-[#37d488]' : 'text-[#f87171]';
              const isHighlighted = index < 3;
              const alternatingBg = index % 2 === 0 ? 'bg-[#112118]' : 'bg-[#0d1a12]';
              const actorLabelMobile = trade.trader
                ? formatWalletAddressMobile(trade.trader)
                : 'Aerodrome LP';
              const actorLink = trade.trader ? getAddressUrl(trade.trader) : null;
              const txHash = trade.txHash ?? trade.id;
              const txLink = getTxUrl(txHash);

              const acesAmt = normalizeAmount(trade.counterAmount);
              const tokenAmt = normalizeAmount(trade.tokenAmount);

              const usdFromTrade = parseMaybeNumber(trade.totalUsd);
              const usdVal = usdFromTrade ?? (acesUsd != null ? acesAmt * acesUsd : null);

              const priceFromTradeUsd = parseMaybeNumber(trade.priceUsd);
              const priceFromCounter =
                trade.priceInCounter && Number.isFinite(trade.priceInCounter) && acesUsd != null
                  ? trade.priceInCounter * acesUsd
                  : null;
              const unitPrice =
                priceFromTradeUsd ??
                (priceFromCounter && priceFromCounter > 0 ? priceFromCounter : null) ??
                (usdVal != null && tokenAmt > 0 ? usdVal / tokenAmt : null);

              return (
                <div
                  key={trade.id}
                  className={cn(
                    'rounded-xl border border-[#2a3b2a] p-3 transition-all duration-300',
                    alternatingBg,
                    isHighlighted && 'shadow-[0_0_0_1px_rgba(24,77,55,0.3)] bg-[#184D37]/15',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    {actorLink ? (
                      <a
                        href={actorLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col text-sm text-white transition-colors hover:text-[#D0B284]"
                      >
                        <span className="font-mono text-[13px]">{actorLabelMobile}</span>
                        <span className="text-[11px] text-[#8F9B8F]">
                          {formatRelativeTime(trade.timestamp)}
                        </span>
                      </a>
                    ) : (
                      <div className="flex flex-col text-sm text-white">
                        <span className="font-mono text-[13px]">{actorLabelMobile}</span>
                        <span className="text-[11px] text-[#8F9B8F]">
                          {formatRelativeTime(trade.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col items-end text-right">
                      <span className={cn('text-[13px] font-semibold', accent)}>
                        {isBuy ? 'Buy' : 'Sell'}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-[#8F9B8F]">
                        {formatUnitPrice(unitPrice)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] uppercase tracking-wide text-[#8F9B8F]">
                    <span>USD</span>
                    <span className={cn('text-right font-mono text-[13px]', accent)}>
                      {formatUsd(usdVal, { isBuy })}
                    </span>
                    <span>ACES</span>
                    <span className={cn('text-right font-mono text-[13px]', accent)}>
                      {formatAcesAmount(trade.counterAmount)}
                    </span>
                    <span>{tokenSymbol}</span>
                    <span className={cn('text-right font-mono text-[13px]', accent)}>
                      {formatTokenAmount(trade.tokenAmount)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-[#8F9B8F]">
                      Txn
                    </span>
                    <a
                      href={txLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2a3b2a] px-2 py-1 text-[11px] text-[#D0B284] transition-colors hover:bg-[#D0B284]/10"
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses} style={style}>
      <div className={contentClasses}>{mainContent}</div>
    </div>
  );
}
