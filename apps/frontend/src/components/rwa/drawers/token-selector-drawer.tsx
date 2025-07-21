'use client';

import { useState } from 'react';
import { Search, X, Star, Users } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Token {
  symbol: string;
  name: string;
  ticker: string;
  icon: string;
  color?: string;
  balance?: string;
  isFavorite?: boolean;
  hasCommunity?: boolean;
}

interface TokenSelectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenSelect: (token: Token) => void;
}

const AVAILABLE_TOKENS: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    ticker: 'ETH',
    icon: '/svg/eth.svg',
    color: 'invert brightness-200',
    balance: '2.45',
    isFavorite: false,
    hasCommunity: false,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    ticker: 'USDC',
    icon: '/svg/usdc.svg',
    balance: '0.00',
    isFavorite: false,
    hasCommunity: false,
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    ticker: 'USDT',
    icon: '/svg/tether.svg',
    balance: '0.00',
    isFavorite: false,
    hasCommunity: false,
  },
];

export default function TokenSelectorDrawer({
  isOpen,
  onClose,
  onTokenSelect,
}: TokenSelectorDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTokens = AVAILABLE_TOKENS.filter((token) => {
    const matchesSearch =
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.ticker.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const handleTokenSelect = (token: Token) => {
    onTokenSelect(token);
    onClose();
  };

  const toggleFavorite = (tokenSymbol: string) => {
    // In a real implementation, this would update the token's favorite status
    console.log('Toggle favorite for:', tokenSymbol);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Token Selector Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#231F20] border border-[#D0B284]/30 rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#D0B284]/10">
            <h3 className="text-white font-bold text-lg">Select pay token</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-[#DCDDCC] hover:text-white hover:bg-[#231F20]/50 rounded-xl"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Search Bar */}
            <div className="p-4 border-b border-[#D0B284]/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#928357]" />
                <Input
                  type="text"
                  placeholder="Search token name or address"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#2A2627] border-[#D0B284]/20 text-white placeholder:text-[#928357] rounded-xl"
                />
              </div>
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between text-sm text-[#928357] mb-3">
                  <span>Recommended</span>
                  <span>Balance</span>
                </div>

                <div className="space-y-2">
                  {filteredTokens.map((token) => (
                    <div
                      key={token.symbol}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-[#2A2627]/50 transition-colors cursor-pointer"
                      onClick={() => handleTokenSelect(token)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`w-8 h-8 bg-gradient-to-r ${token.color} rounded-full flex items-center justify-center relative`}
                        >
                          <Image
                            src={token.icon}
                            alt={token.name}
                            width={20}
                            height={20}
                            className="w-5 h-5"
                          />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{token.name}</span>
                            {token.hasCommunity && <Users className="w-3 h-3 text-green-400" />}
                          </div>
                          <span className="text-[#928357] text-xs font-mono">{token.ticker}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[#928357] text-sm font-mono min-w-[40px] text-right">
                          {token.balance}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(token.symbol);
                          }}
                          className="text-[#928357] hover:text-[#D0B284] hover:bg-[#D0B284]/10 rounded-lg"
                        >
                          <Star
                            className={`w-4 h-4 ${token.isFavorite ? 'fill-[#D0B284] text-[#D0B284]' : ''}`}
                          />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
