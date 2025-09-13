import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { TokensApi, TokenData } from '@/lib/api/tokens';

interface SimpleTokenChartProps {
  tokenAddress: string;
  tokenSymbol?: string;
  title?: string;
  imageSrc?: string;
  height?: string;
}

const SimpleTokenChart: React.FC<SimpleTokenChartProps> = ({
  tokenAddress,
  tokenSymbol = 'TOKEN',
  title = 'Token Chart',
  imageSrc = '/canvas-image/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp',
  height = 'h-[500px]',
}) => {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTokenData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await TokensApi.getTokenData(tokenAddress);

      if (result.success && result.data) {
        setTokenData(result.data);
      } else {
        const errorMessage = result.error
          ? typeof result.error === 'string'
            ? result.error
            : result.error.message
          : 'Failed to fetch token data';
        setError(errorMessage);
      }
    } catch (err) {
      setError('Network error');
      console.error('Token data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      setIsRefreshing(true);
      const result = await TokensApi.refreshTokenData(tokenAddress);

      if (result.success && result.data) {
        setTokenData(result.data);
      } else {
        const errorMessage = result.error
          ? typeof result.error === 'string'
            ? result.error
            : result.error.message
          : 'Failed to refresh token data';
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tokenAddress) {
      fetchTokenData();
    }
  }, [tokenAddress]);

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (num === 0) return '0.00';
    if (num < 0.001) return num.toExponential(3);
    return num.toFixed(6);
  };

  const formatVolume = (volume: string) => {
    const num = parseFloat(volume);
    if (num === 0) return '0';
    if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num > 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className={`flex flex-col ${height} w-full bg-[#231f20]/50 overflow-hidden`}>
      {/* Header */}
      <div className="space-y-3 p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden bg-[#231F20]/60 border border-[#D0B284]/20">
              <Image
                src={imageSrc}
                alt={title}
                width={48}
                height={48}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="mt-1">
              <div className="flex items-center gap-2 rounded-md bg-[#231F20]/60 px-2 py-1.5 border border-[#D0B284]/20 w-fit">
                <span className="text-xs text-[#DCDDCC] font-mono">
                  {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
                </span>
                <span className="text-sm text-[#DCDDCC]">${tokenData?.symbol || tokenSymbol}</span>
                <button
                  onClick={() => copyToClipboard(tokenAddress)}
                  className="flex h-5 w-5 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#D0B284"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="px-3 py-1 rounded text-xs bg-[#D0B284]/20 text-[#D0B284] border border-[#D0B284]/40 hover:bg-[#D0B284]/30 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Data Display */}
      <div className="flex-1 w-full bg-[#231F20] rounded-none border-t border-[#D0B284]/20 min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[#DCDDCC]">Loading token data...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400">Error: {error}</div>
          </div>
        ) : tokenData ? (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-[#DCDDCC]">Token Name</div>
                  <div className="text-lg text-white">{tokenData.name || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-sm text-[#DCDDCC]">Current Price</div>
                  <div className="text-xl font-bold text-white">
                    {formatPrice(tokenData.currentPriceACES || '0')} ACES
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-[#DCDDCC]">24h Volume</div>
                  <div className="text-lg text-white">
                    {formatVolume(tokenData.volume24h || '0')} ACES
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[#DCDDCC]">Status</div>
                  <div className="text-sm text-green-400">
                    {tokenData.phase ? tokenData.phase.replace('_', ' ') : 'Unknown'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-[#D0B284]/10 rounded border border-[#D0B284]/20">
              <div className="text-sm text-[#DCDDCC] text-center">
                📊 Live trading data from bonding curve • Advanced charts coming soon
              </div>
            </div>

            <div className="mt-2 text-xs text-[#DCDDCC]/60 text-center">
              Last updated:{' '}
              {tokenData.updatedAt ? new Date(tokenData.updatedAt).toLocaleString() : 'Unknown'}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SimpleTokenChart;
