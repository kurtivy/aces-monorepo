'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { useEffect, useState } from 'react';
import { ProfileApi, TokenData } from '@/lib/api/profile';

export function TokenListTab() {
  const { getAccessToken } = useAuth();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState({ eth: 0, usd: 0 });

  useEffect(() => {
    const fetchUserTokens = async () => {
      const authToken = await getAccessToken();
      if (!authToken) return;

      try {
        const result = await ProfileApi.getUserTokens(authToken);
        if (result.success) {
          // Backend returns tokens directly in data, not in data.tokens
          const backendTokens = result.data;

          // Transform backend data to frontend TokenData format
          const transformedTokens: TokenData[] = backendTokens.map((token) => ({
            id: token.id,
            title: token.title,
            ticker: token.ticker,
            image: token.image,
            contractAddress: token.contractAddress,
            category: token.category,
            amount: 1, // Default to 1 since backend doesn't provide amount
            totalInEth: parseFloat(token.value) || 0,
            totalInAces: parseFloat(token.value) || 0, // Using same value for now
            totalInUSD: parseFloat(token.value) || 0, // Using same value for now
          }));

          setTokens(transformedTokens);

          // Calculate total value from tokens
          const totalEth = transformedTokens.reduce((sum, token) => sum + token.totalInEth, 0);
          const totalUsd = transformedTokens.reduce((sum, token) => sum + token.totalInUSD, 0);
          setTotalValue({ eth: totalEth, usd: totalUsd });
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError('Failed to fetch tokens');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserTokens();
  }, [getAccessToken]);

  if (isLoading) {
    return (
      <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#D0B284]/10 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#D0B284]/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-xl bg-[#231F20] border border-red-500/20 shadow-lg p-6">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  // Add null check for tokens array
  if (!tokens || tokens.length === 0) {
    return (
      <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg p-6">
        <div className="text-center text-[#DCDDCC]">
          <p className="mb-4">No tokens found in your portfolio</p>
          <Button
            className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
            onClick={() => (window.location.href = '/list-token')}
          >
            Create Token
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-2xl font-bold text-white font-libre-caslon mb-1">
              {totalValue.eth.toFixed(6)} ETH
            </div>
            <div className="text-[#DCDDCC] text-sm">${totalValue.usd.toLocaleString()}</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  RWA
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Ticker
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Contract
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Action
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Amount
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Total ETH
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Total ACES
                </th>
                <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Total USD
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {tokens.map((token) => (
                <tr
                  key={token.id}
                  className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5 transition-colors duration-200"
                >
                  {/* RWA Info */}
                  <td className="py-4 px-2">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Image
                          src={token.image || '/placeholder.svg'}
                          alt={token.title}
                          className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                          width={40}
                          height={40}
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-[#231F20] flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate text-sm">
                          {token.title.split(' ').slice(0, 2).join(' ')}
                        </h3>
                        <Badge
                          variant="secondary"
                          className="bg-[#D0B284]/10 text-[#D0B284] text-xs px-2 py-0.5 mt-1"
                        >
                          {token.category}
                        </Badge>
                      </div>
                    </div>
                  </td>

                  {/* Ticker */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-[#DCDDCC] font-jetbrains text-sm">{token.ticker}</span>
                  </td>

                  {/* Contract Address */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-[#DCDDCC] font-jetbrains text-xs">
                      {token.contractAddress}
                    </span>
                  </td>

                  {/* Action Button */}
                  <td className="py-4 px-2 text-center">
                    <Button
                      size="sm"
                      className="bg-[#184D37] hover:bg-[#184D37]/80 text-white px-3 py-1 text-xs"
                    >
                      View Asset
                    </Button>
                  </td>

                  {/* Amount */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-white font-medium text-sm">
                      {token.amount.toLocaleString()}
                    </span>
                  </td>

                  {/* Total in ETH */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-white font-medium text-sm">
                      {token.totalInEth.toFixed(4)}
                    </span>
                  </td>

                  {/* Total in ACES */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-white font-medium text-sm">
                      {token.totalInAces.toFixed(6)}
                    </span>
                  </td>

                  {/* Total in USD */}
                  <td className="py-4 px-2 text-right">
                    <span className="text-[#D0B284] font-medium text-sm">
                      ${token.totalInUSD.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
