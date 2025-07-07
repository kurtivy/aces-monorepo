'use client';

import { useState } from 'react';
import { ArrowUpDown, Zap, TrendingUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SwapInterfaceProps {
  tokenSymbol?: string;
}

export default function SwapInterface({ tokenSymbol = 'RWA' }: SwapInterfaceProps) {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState(tokenSymbol);
  const [isLoading, setIsLoading] = useState(false);

  const handleSwapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);
    if (value) {
      setIsLoading(true);
      setTimeout(() => {
        const rate = fromToken === 'ETH' ? 0.000012 : 83333;
        setToAmount((Number.parseFloat(value) * rate).toFixed(6));
        setIsLoading(false);
      }, 300);
    } else {
      setToAmount('');
    }
  };

  const handleSwap = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-[#D0B264] via-[#D0B264]/70 to-emerald-500/50" />

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/70 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Swap</h3>
            <p className="text-sm text-gray-400">Trade tokens instantly</p>
          </div>
        </div>

        {/* Swap Interface */}
        <div className="space-y-2">
          {/* From Token */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">From</span>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Balance: 2.45 {fromToken}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs px-2 py-1 h-auto text-[#D0B264] hover:bg-[#D0B264]/10 rounded-md"
                >
                  MAX
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                placeholder="0.00"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                className="bg-transparent border-none text-2xl font-bold text-white placeholder:text-gray-600 p-0 h-auto focus-visible:ring-0 font-mono"
                step="0.000001"
              />
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-medium px-4 py-2 rounded-xl backdrop-blur-sm shrink-0"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/70 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-black">E</span>
                  </div>
                  <span>{fromToken}</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </Button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-gray-400 font-mono">
                ≈ ${fromAmount ? (Number.parseFloat(fromAmount) * 3420).toFixed(2) : '0.00'}
              </div>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>+2.4%</span>
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center relative -my-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSwapTokens}
              className="bg-black/80 hover:bg-black/90 border-2 border-white/20 hover:border-[#D0B264]/50 rounded-full w-12 h-12 backdrop-blur-sm transition-all duration-300 hover:scale-110"
            >
              <ArrowUpDown className="h-5 w-5 text-[#D0B264]" />
            </Button>
          </div>

          {/* To Token */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">To</span>
              <div className="text-sm text-gray-400">Balance: 0.00 {toToken}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={toAmount}
                  readOnly
                  className="bg-transparent border-none text-2xl font-bold text-white placeholder:text-gray-600 p-0 h-auto focus-visible:ring-0 font-mono"
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-6 h-6 border-2 border-[#D0B264] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-medium px-4 py-2 rounded-xl backdrop-blur-sm shrink-0"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-emerald-500 to-[#D0B264] rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-black">R</span>
                  </div>
                  <span>{toToken}</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </Button>
            </div>
            <div className="mt-3">
              <div className="text-sm text-gray-400 font-mono">
                ≈ ${toAmount ? (Number.parseFloat(toAmount) * 83333).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Swap Details */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Price Impact</span>
            <span className="text-sm text-green-400">{'<0.01%'}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Gas Fee</span>
            <span className="text-sm text-white font-mono">~$2.50</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Est. Time</span>
            <span className="text-sm text-white">~15s</span>
          </div>
        </div>

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!fromAmount || !toAmount || isLoading}
          className="w-full bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-bold py-4 text-lg rounded-xl transition-all duration-200 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Swapping...
            </div>
          ) : (
            'Swap'
          )}
        </Button>
      </div>
    </div>
  );
}
