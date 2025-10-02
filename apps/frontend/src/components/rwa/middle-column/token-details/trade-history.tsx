'use client';

import { useTradeHistory } from '@/hooks/rwa/use-trade-history';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TradeHistoryProps {
  tokenAddress: string;
  tokenSymbol?: string;
}

export default function TradeHistory({ tokenAddress, tokenSymbol = 'TOKEN' }: TradeHistoryProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { trades, isLoading, error, isConnected, refresh } = useTradeHistory(tokenAddress);

  // Safety check - ensure trades is always an array
  const safeTrades = Array.isArray(trades) ? trades : [];

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="bg-black rounded-xl overflow-hidden">
        <div className="p-4">
          <div className="text-[#D0B284] text-lg font-bold mb-4">Recent Trades</div>
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  // Format ACES amount from 18-decimal Ethereum format
  const formatAcesAmount = (amount: string) => {
    // Convert from wei (18 decimals) to ACES tokens
    const weiAmount = BigInt(amount);
    const acesAmount = Number(weiAmount) / Math.pow(10, 18);

    if (acesAmount >= 1000000) return `${(acesAmount / 1000000).toFixed(2)}M`;
    if (acesAmount >= 1000) return `${(acesAmount / 1000).toFixed(2)}K`;
    return acesAmount.toFixed(4);
  };

  // Format token amount from 18-decimal Ethereum format
  const formatTokenAmount = (amount: string) => {
    // Convert from wei (18 decimals) to tokens
    const weiAmount = BigInt(amount);
    const tokenAmount = Number(weiAmount) / Math.pow(10, 18);

    if (tokenAmount >= 1000000) return `${(tokenAmount / 1000000).toFixed(2)}M`;
    if (tokenAmount >= 1000) return `${(tokenAmount / 1000).toFixed(2)}K`;
    return tokenAmount.toFixed(2);
  };

  // Format wallet address (truncate)
  const formatWalletAddress = (address: string) => {
    const prefix = address.slice(0, 7);
    const suffix = address.slice(-4);
    return `${prefix}…${suffix}`;
  };

  // Format transaction hash (truncate)
  const formatTxHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    const now = Date.now();
    const tradeTime = parseInt(timestamp) * 1000;
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

  // Base Sepolia explorer URLs
  const getAddressUrl = (address: string) => `https://sepolia.basescan.org/address/${address}`;

  const getTxUrl = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`;

  if (isLoading && safeTrades.length === 0) {
    return (
      <div className="bg-[#151c16] rounded-xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#D0B284] text-lg font-bold">Recent Trades</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-[#151c16]/50 rounded-lg animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-gray-600 rounded-full" />
                  <div className="w-20 h-4 bg-gray-600 rounded" />
                </div>
                <div className="w-12 h-4 bg-gray-600 rounded" />
                <div className="w-16 h-4 bg-gray-600 rounded" />
                <div className="w-12 h-4 bg-gray-600 rounded" />
                <div className="w-16 h-4 bg-gray-600 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#151c16] rounded-xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#D0B284] text-lg font-bold">Recent Trades</h3>
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-3 py-1 rounded text-xs bg-[#D0B284]/20 text-[#D0B284] border border-[#D0B284]/40 hover:bg-[#D0B284]/30 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
          <div className="text-center py-8">
            <div className="text-red-400 mb-2">Error loading trades</div>
            <div className="text-gray-400 text-sm mb-4">{error}</div>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-[#D0B284]/20 text-[#D0B284] border border-[#D0B284]/40 rounded-lg hover:bg-[#D0B284]/30 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (safeTrades.length === 0) {
    return (
      <div className="bg-[#151c16] rounded-xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#D0B284] text-lg font-bold">Recent Trades</h3>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}
              />
              <span className="text-xs text-gray-400">{isConnected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
          <div className="text-center py-8">
            <div className="text-[#D0B284] mb-2">No trades yet for this token</div>
            <div className="text-gray-400 text-sm">Trades will appear here as they happen</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#151c16] rounded-xl overflow-hidden mt-0">
      <div className="p-4">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="py-2 px-3 text-xs text-[#DCDDCC] font-medium text-left">Account</th>
                <th className="py-2 px-3 text-xs text-[#DCDDCC] font-medium text-center">Trade</th>
                <th className="py-2 px-3 text-xs text-[#DCDDCC] font-medium text-right">$ ACES</th>
                <th className="py-2 px-3 text-xs text-[#DCDDCC] font-medium text-right">
                  $ {tokenSymbol}
                </th>
                <th className="py-2 px-3 text-xs text-[#DCDDCC] font-medium text-center">Time</th>
                <th className="py-2 px-3 text-xs text-[#DCDDCC] font-medium text-center">Txn</th>
              </tr>
            </thead>
            <tbody>
              {safeTrades.map((trade, index) => (
                <tr
                  key={trade.id}
                  className={`border-b border-[#D0B284]/10 hover:bg-[#231F20]/30 transition-all duration-300 ${
                    index < 3 ? 'animate-pulse bg-[#184D37]/5' : ''
                  }`}
                >
                  <td className="py-3 px-3">
                    <a
                      href={getAddressUrl(trade.trader.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white hover:text-[#D0B284] transition-colors"
                    >
                      <div className="w-6 h-6 bg-[#D0B284] rounded-full flex items-center justify-center">
                        <span className="text-black text-xs font-bold">👤</span>
                      </div>
                      <span className="font-mono">{formatWalletAddress(trade.trader.id)}</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`text-sm font-medium ${trade.isBuy ? 'text-[#184D37]' : 'text-red-400'}`}
                    >
                      {trade.isBuy ? 'Buy' : 'Sell'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`text-sm font-mono font-medium ${trade.isBuy ? 'text-[#184D37]' : 'text-red-400'}`}
                    >
                      {formatAcesAmount(trade.acesTokenAmount)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`text-sm font-mono font-medium ${trade.isBuy ? 'text-[#184D37]' : 'text-red-400'}`}
                    >
                      {formatTokenAmount(trade.tokenAmount)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-sm text-gray-400">
                      {formatRelativeTime(trade.createdAt)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <a
                      href={getTxUrl(trade.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-white hover:text-[#D0B284] transition-colors"
                    >
                      <span className="font-mono">{formatTxHash(trade.id)}</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Table */}
        <div className="md:hidden space-y-3 text-xs">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center gap-2 px-3 text-[11px] uppercase tracking-wide text-[#8F9B8F] justify-items-center">
            <span className="justify-self-start text-left">Account</span>
            <span>Trade</span>
            <span>$ ACES</span>
            <span>$ {tokenSymbol}</span>
            <span>Txn</span>
          </div>

          <div className="space-y-2">
            {safeTrades.map((trade, index) => (
              <div
                key={trade.id}
                className={`grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-center gap-2 rounded-xl border border-[#2a3b2a] bg-[#101910] px-3 py-3 transition-all duration-300 justify-items-center ${
                  index < 3 ? 'shadow-[0_0_0_1px_rgba(24,77,55,0.3)]' : ''
                }`}
              >
                <a
                  href={getAddressUrl(trade.trader.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-start justify-center gap-1 text-sm text-white hover:text-[#D0B284] transition-colors w-full"
                >
                  <span className="font-mono text-[13px]">
                    {formatWalletAddress(trade.trader.id)}
                  </span>
                  <span className="text-[#8F9B8F] text-[11px]">
                    {trade.trader.id.slice(-4)} · {formatRelativeTime(trade.createdAt)}
                  </span>
                </a>

                <div className="flex flex-col items-center text-[12px] text-center">
                  <span
                    className={`font-semibold ${trade.isBuy ? 'text-[#37d488]' : 'text-[#f87171]'}`}
                  >
                    {trade.isBuy ? 'Buy' : 'Sell'}
                  </span>
                </div>

                <div className="text-center">
                  <span
                    className={`font-mono text-[13px] ${trade.isBuy ? 'text-[#37d488]' : 'text-[#f87171]'}`}
                  >
                    {formatAcesAmount(trade.acesTokenAmount)}
                  </span>
                </div>

                <div className="text-center">
                  <span
                    className={`font-mono text-[13px] ${trade.isBuy ? 'text-[#37d488]' : 'text-[#f87171]'}`}
                  >
                    {formatTokenAmount(trade.tokenAmount)}
                  </span>
                </div>

                <div className="flex justify-center">
                  <a
                    href={getTxUrl(trade.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#2a3b2a] px-2 py-1 text-[11px] text-[#D0B284] hover:bg-[#D0B284]/10 transition-colors"
                  >
                    Txn
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
