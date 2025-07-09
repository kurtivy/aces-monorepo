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
    <div className="h-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
      {/* Top accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-[#D0B264] via-[#D0B264]/70 to-emerald-500/50" />

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col">
        {/* Header - made more compact */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/70 rounded-md flex items-center justify-center">
            <Zap className="w-3 h-3 text-black" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-none">Swap</h3>
            <p className="text-xs text-gray-400">Trade tokens instantly</p>
          </div>
        </div>

        {/* Swap Interface */}
        <div className="flex-1 flex flex-col justify-between gap-1">
          {/* From Token */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">From</span>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span>Balance: 2.45 {fromToken}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs px-1 py-0.5 h-auto text-[#D0B264] hover:bg-[#D0B264]/10 rounded"
                >
                  MAX
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="0.00"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                className="bg-transparent border-none text-lg font-bold text-white placeholder:text-gray-600 p-0 h-auto focus-visible:ring-0 font-mono"
                step="0.000001"
              />
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-medium px-2 py-1 rounded-lg backdrop-blur-sm shrink-0 h-7"
              >
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/70 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-black">E</span>
                  </div>
                  <span className="text-xs">{fromToken}</span>
                  <ChevronDown className="w-3 h-3" />
                </div>
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs text-gray-400 font-mono">
                ≈ ${fromAmount ? (Number.parseFloat(fromAmount) * 3420).toFixed(2) : '0.00'}
              </div>
              <div className="flex items-center gap-0.5 text-xs text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>+2.4%</span>
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center relative -my-1 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSwapTokens}
              className="bg-black/80 hover:bg-black/90 border-2 border-white/20 hover:border-[#D0B264]/50 rounded-full w-8 h-8 backdrop-blur-sm transition-all duration-300 hover:scale-110"
            >
              <ArrowUpDown className="h-4 w-4 text-[#D0B264]" />
            </Button>
          </div>

          {/* To Token */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">To</span>
              <div className="text-xs text-gray-400">Balance: 0.00 {toToken}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={toAmount}
                  readOnly
                  className="bg-transparent border-none text-lg font-bold text-white placeholder:text-gray-600 p-0 h-auto focus-visible:ring-0 font-mono"
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-4 h-4 border-2 border-[#D0B264] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-medium px-2 py-1 rounded-lg backdrop-blur-sm shrink-0 h-7"
              >
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-gradient-to-r from-emerald-500 to-[#D0B264] rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-black">R</span>
                  </div>
                  <span className="text-xs">{toToken}</span>
                  <ChevronDown className="w-3 h-3" />
                </div>
              </Button>
            </div>
            <div className="mt-1">
              <div className="text-xs text-gray-400 font-mono">
                ≈ ${toAmount ? (Number.parseFloat(toAmount) * 83333).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>

          {/* Swap Details - made more compact */}
          <div className="bg-white/5 rounded-lg p-2 border border-white/10">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex flex-col">
                <span className="text-gray-400">Impact</span>
                <span className="text-green-400">{'<0.01%'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400">Gas</span>
                <span className="text-white font-mono">~$2.50</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400">Time</span>
                <span className="text-white">~15s</span>
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <Button
            onClick={handleSwap}
            disabled={!fromAmount || !toAmount || isLoading}
            className="w-full bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-bold py-2 text-sm rounded-lg transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Swapping...
              </div>
            ) : (
              'Swap'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
