'use client';

import { useState } from 'react';
import { RefreshCw, Wifi, WifiOff, AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { useBondingCurveContracts } from '@/hooks/contracts/use-bonding-curve-contract';

interface UniswapPriceIndicatorProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export default function UniswapPriceIndicator({
  className = '',
  showDetails = true,
  compact = false,
}: UniswapPriceIndicatorProps) {
  const { ethPrice } = useBondingCurveContracts();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await ethPrice.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  const getStatusIcon = () => {
    if (ethPrice.isLoading || isRefreshing) {
      return <RefreshCw className="w-3 h-3 animate-spin text-[#D0B284]" />;
    }
    if (ethPrice.error) {
      return <WifiOff className="w-3 h-3 text-red-400" />;
    }
    if (ethPrice.isStale) {
      return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
    }
    return <Wifi className="w-3 h-3 text-green-400" />;
  };

  const getNetworkColor = () => {
    switch (ethPrice.network) {
      case 'mainnet':
        return 'text-blue-400';
      case 'base':
        return 'text-blue-500';
      case 'arbitrum':
        return 'text-cyan-400';
      case 'polygon':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const getPoolUrl = () => {
    if (!ethPrice.poolInfo?.address) return null;

    const baseUrl = 'https://info.uniswap.org/#';
    switch (ethPrice.network) {
      case 'mainnet':
        return `${baseUrl}/pools/${ethPrice.poolInfo.address}`;
      case 'base':
        return `https://info.uniswap.org/#/base/pools/${ethPrice.poolInfo.address}`;
      case 'arbitrum':
        return `https://info.uniswap.org/#/arbitrum/pools/${ethPrice.poolInfo.address}`;
      case 'polygon':
        return `https://info.uniswap.org/#/polygon/pools/${ethPrice.poolInfo.address}`;
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        <span className="text-[#DCDDCC] text-sm font-mono">
          ${ethPrice.current.toLocaleString()}
        </span>
        <button
          onClick={handleRefresh}
          disabled={ethPrice.isLoading || isRefreshing}
          className="text-[#D0B284] hover:text-[#D7BF75] transition-colors duration-200 disabled:opacity-50"
          title="Refresh ETH price"
        >
          <RefreshCw
            className={`w-3 h-3 ${ethPrice.isLoading || isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-[#231F20]/30 border border-[#D0B284]/20 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Status and Price */}
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-[#DCDDCC] text-lg font-bold font-mono">
              ETH: ${ethPrice.current.toLocaleString()}
            </span>
          </div>

          {/* Uniswap Badge */}
          <div className="flex items-center gap-1 bg-[#FF007A]/10 border border-[#FF007A]/30 rounded-full px-2 py-1">
            <div className="w-2 h-2 bg-[#FF007A] rounded-full"></div>
            <span className="text-[#FF007A] text-xs font-medium">Uniswap V3</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Info tooltip */}
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-[#928357] hover:text-[#D0B284] transition-colors duration-200"
            >
              <Info className="w-4 h-4" />
            </button>

            {showTooltip && (
              <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#231F20] border border-[#D0B284]/30 rounded-lg p-3 text-xs z-50">
                <div className="space-y-1">
                  <div className="text-[#DCDDCC] font-medium">Price Feed Details</div>
                  <div className="text-[#928357]">Source: Uniswap V3 Subgraph</div>
                  <div className="text-[#928357]">Network: {ethPrice.network}</div>
                  {ethPrice.poolInfo && (
                    <>
                      <div className="text-[#928357]">Fee Tier: {ethPrice.poolInfo.feeTier}</div>
                      <div className="text-[#928357]">
                        24h Volume: ${ethPrice.poolInfo.volume24h}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* External link to pool */}
          {getPoolUrl() && (
            <a
              href={getPoolUrl()!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#928357] hover:text-[#D0B284] transition-colors duration-200"
              title="View pool on Uniswap"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={ethPrice.isLoading || isRefreshing}
            className="text-[#D0B284] hover:text-[#D7BF75] transition-colors duration-200 disabled:opacity-50"
            title="Refresh ETH price"
          >
            <RefreshCw
              className={`w-4 h-4 ${ethPrice.isLoading || isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Network and Time Info */}
          <div className="flex items-center justify-between text-xs mb-3">
            <div className="flex items-center gap-3">
              <span className={`font-mono ${getNetworkColor()}`}>
                {ethPrice.network?.toUpperCase()}
              </span>
              <span className="text-[#928357] font-mono">{formatTime(ethPrice.lastUpdated)}</span>
            </div>

            {ethPrice.poolInfo && (
              <span className="text-[#928357] font-mono">Fee: {ethPrice.poolInfo.feeTier}</span>
            )}
          </div>

          {/* Pool Stats */}
          {ethPrice.poolInfo && (
            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <div>
                <span className="text-[#928357]">Liquidity:</span>
                <div className="text-[#DCDDCC] font-mono">${ethPrice.poolInfo.liquidity}</div>
              </div>
              <div>
                <span className="text-[#928357]">24h Volume:</span>
                <div className="text-[#DCDDCC] font-mono">${ethPrice.poolInfo.volume24h}</div>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {ethPrice.error && (
            <div className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded p-2">
              ⚠️ {ethPrice.error}
            </div>
          )}

          {ethPrice.isStale && !ethPrice.error && (
            <div className="text-xs text-yellow-400 font-mono bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
              ⏰ Price data is stale
            </div>
          )}

          {!ethPrice.error && !ethPrice.isStale && (
            <div className="text-xs text-green-400 font-mono bg-green-500/10 border border-green-500/20 rounded p-2">
              ✅ Live Uniswap price feed active
            </div>
          )}
        </>
      )}
    </div>
  );
}
