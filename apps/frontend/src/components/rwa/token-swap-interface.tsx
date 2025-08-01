'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TokenSwapInterfaceProps {
  tokenSymbol?: string;
  tokenPrice?: number;
  userBalance?: number;
  onMakeOffer?: () => void;
}

export default function TokenSwapInterface({
  tokenSymbol = 'RWA',
  tokenPrice = 0.000268,
  userBalance = 0.5,
  onMakeOffer,
}: TokenSwapInterfaceProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippage] = useState('0.5');
  const [isConnected, setIsConnected] = useState(false);

  const quickAmounts = [
    { label: 'Reset', value: '' },
    { label: '0.01 ETH', value: '0.01' },
    { label: '0.1 ETH', value: '0.1' },
    { label: '0.5 ETH', value: '0.5' },
    { label: 'Max', value: userBalance.toString() },
  ];

  const handleQuickAmount = (value: string) => {
    setAmount(value);
  };

  const calculateTokenAmount = () => {
    if (!amount || !tokenPrice) return '0';
    const ethAmount = Number.parseFloat(amount);
    const tokenAmount = ethAmount / tokenPrice;
    return tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const calculateEthValue = () => {
    if (!amount || !tokenPrice) return '0';
    const tokenAmount = Number.parseFloat(amount);
    const ethValue = tokenAmount * tokenPrice;
    return ethValue.toFixed(6);
  };

  return (
    <div className="h-full">
      <div className="bg-black rounded-lg border border-[#D0B284]/20 p-6 h-full flex flex-col">
        <h3 className="text-[#D0B284] text-xl font-bold mb-6 text-center">Trade {tokenSymbol}</h3>

        {/* Make Offer Button */}
        {onMakeOffer && (
          <div className="mb-6">
            <Button
              onClick={onMakeOffer}
              className="w-full h-12 bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold text-lg rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              <span className="tracking-wider" style={{ fontFamily: "'Spray Letters', cursive" }}>
                MAKE OFFER
              </span>
            </Button>
          </div>
        )}

        {/* Buy/Sell Toggle */}
        <div className="flex mb-6 bg-[#231F20] rounded-lg p-1 border border-[#D0B284]/20">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
              activeTab === 'buy'
                ? 'bg-[#184D37] text-white shadow-lg'
                : 'text-[#DCDDCC] hover:text-white hover:bg-[#D0B284]/10'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
              activeTab === 'sell'
                ? 'bg-[#8B4513] text-white shadow-lg'
                : 'text-[#DCDDCC] hover:text-white hover:bg-[#D0B284]/10'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Settings Row */}
        <div className="flex justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#DCDDCC] hover:text-[#D0B284] border border-[#D0B284]/20 hover:border-[#D0B284]/40"
          >
            Switch to Base
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#DCDDCC] hover:text-[#D0B284] border border-[#D0B284]/20 hover:border-[#D0B284]/40"
          >
            Slippage: {slippage}%
          </Button>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <div className="relative">
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-16 text-2xl font-bold bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] pr-20"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0052FF] rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">ETH</span>
              </div>
              <span className="text-[#D0B284] font-semibold">ETH</span>
            </div>
          </div>

          {/* Conversion Display */}
          {amount && (
            <div className="mt-2 text-sm text-[#DCDDCC] text-center">
              {activeTab === 'buy' ? (
                <span>
                  ≈ {calculateTokenAmount()} {tokenSymbol}
                </span>
              ) : (
                <span>≈ {calculateEthValue()} ETH</span>
              )}
            </div>
          )}
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {quickAmounts.map((quick) => (
            <Button
              key={quick.label}
              variant="ghost"
              size="sm"
              onClick={() => handleQuickAmount(quick.value)}
              className="text-[#DCDDCC] hover:text-[#D0B284] border border-[#D0B284]/20 hover:border-[#D0B284]/40 hover:bg-[#D0B284]/10"
            >
              {quick.label}
            </Button>
          ))}
        </div>

        {/* Balance Display */}
        <div className="mb-6 p-3 bg-[#231F20] rounded-lg border border-[#D0B284]/20">
          <div className="flex justify-between text-sm">
            <span className="text-[#DCDDCC]">Your Balance:</span>
            <span className="text-white font-mono">{userBalance.toFixed(4)} ETH</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-[#DCDDCC]">{tokenSymbol} Holdings:</span>
            <span className="text-white font-mono">1,247 {tokenSymbol}</span>
          </div>
        </div>

        {/* Trade Button */}
        <div className="mt-auto">
          {!isConnected ? (
            <Button
              onClick={() => setIsConnected(true)}
              className="w-full h-14 bg-[#184D37] hover:bg-[#184D37]/90 text-white font-bold text-lg rounded-lg"
            >
              Connect Wallet
            </Button>
          ) : (
            <Button
              disabled={!amount || Number.parseFloat(amount) <= 0}
              className={`w-full h-14 font-bold text-lg rounded-lg transition-all duration-200 ${
                activeTab === 'buy'
                  ? 'bg-[#184D37] hover:bg-[#184D37]/90 text-white'
                  : 'bg-[#8B4513] hover:bg-[#8B4513]/90 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {activeTab === 'buy' ? `Buy ${tokenSymbol}` : `Sell ${tokenSymbol}`}
            </Button>
          )}
        </div>

        {/* Transaction Info */}
        {amount && Number.parseFloat(amount) > 0 && (
          <div className="mt-4 p-3 bg-[#231F20]/50 rounded-lg border border-[#D0B284]/10">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#DCDDCC]">Price Impact:</span>
                <span className="text-[#184D37]">{'<0.01%'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#DCDDCC]">Network Fee:</span>
                <span className="text-white">~$2.50</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#DCDDCC]">Slippage Tolerance:</span>
                <span className="text-white">{slippage}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Network Badge */}
        <div className="mt-4 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#0052FF]/20 border border-[#0052FF]/40 rounded-full">
            <div className="w-4 h-4 bg-[#0052FF] rounded-full"></div>
            <span className="text-[#0052FF] text-xs font-medium">Base Mainnet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
