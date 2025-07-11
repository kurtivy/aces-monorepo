'use client';

import { useState } from 'react';
import { ArrowUpDown, Settings, Info, ChevronDown, Zap } from 'lucide-react';
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
    <div className="w-full max-w-md mx-auto">
      {/* Main Container */}
      <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <h2 className="text-xl font-bold text-white">Swap</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-xl"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-6 pb-6 space-y-1">
          {/* Connected Swap Sections */}
          <div className="relative">
            {/* Main container with connected sections */}
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 hover:border-gray-600/50 transition-colors">
              {/* From Token Section */}
              <div className="p-4 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">You pay</span>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>Balance: 2.45</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs px-2 py-1 h-auto text-[#D0B264] hover:bg-[#D0B264]/10 rounded-lg font-medium"
                    >
                      MAX
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="0"
                      value={fromAmount}
                      onChange={(e) => handleFromAmountChange(e.target.value)}
                      className="bg-transparent border-none text-2xl font-bold text-white placeholder:text-gray-600 p-0 h-auto focus-visible:ring-0 font-mono"
                      step="0.000001"
                    />
                    <div className="text-sm text-gray-400 mt-1 font-mono">
                      ${fromAmount ? (Number.parseFloat(fromAmount) * 3420).toFixed(2) : '0.00'}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50 font-medium px-4 py-3 rounded-2xl backdrop-blur-sm shrink-0 h-auto"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-white">Ξ</span>
                      </div>
                      <span className="font-semibold">{fromToken}</span>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </Button>
                </div>
              </div>

              {/* Divider line with notch for swap button */}
              <div className="relative">
                <div className="border-t border-gray-700/50 mx-4"></div>
                {/* Carved out space for swap button */}
                <div className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-12 h-6 bg-gray-800/40 rounded-full"></div>
                </div>
              </div>

              {/* To Token Section */}
              <div className="p-4 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">You receive</span>
                  <div className="text-sm text-gray-400">Balance: 0.00</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      placeholder="0"
                      value={toAmount}
                      readOnly
                      className="bg-transparent border-none text-2xl font-bold text-white placeholder:text-gray-600 p-0 h-auto focus-visible:ring-0 font-mono"
                    />
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-5 h-5 border-2 border-[#D0B264] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <div className="text-sm text-gray-400 mt-1 font-mono">
                      ${toAmount ? (Number.parseFloat(toAmount) * 83333).toFixed(2) : '0.00'}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="bg-gray-700/50 border-gray-600/50 text-white hover:bg-gray-600/50 font-medium px-4 py-3 rounded-2xl backdrop-blur-sm shrink-0 h-auto"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-black">R</span>
                      </div>
                      <span className="font-semibold">{toToken}</span>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </Button>
                </div>
              </div>
            </div>

            {/* Swap Button positioned in the carved-out notch */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapTokens}
                className="bg-gray-800 hover:bg-gray-700 border-4 border-gray-900 hover:border-[#D0B264]/20 rounded-xl w-10 h-10 backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <ArrowUpDown className="h-5 w-5 text-gray-300 hover:text-[#D0B264] transition-colors" />
              </Button>
            </div>
          </div>

          {/* Transaction Details */}
          {fromAmount && toAmount && (
            <div className="bg-gray-800/20 rounded-xl p-4 border border-gray-700/30">
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-1 text-gray-400">
                  <span>Rate</span>
                  <Info className="w-3 h-3" />
                </div>
                <span className="text-white font-mono">
                  1 {fromToken} = {fromToken === 'ETH' ? '83,333' : '0.000012'} {toToken}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">Price impact</span>
                <span className="text-green-400">{'<0.01%'}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Network fee</span>
                <span className="text-white font-mono">~$2.50</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <Button
            onClick={handleSwap}
            disabled={!fromAmount || !toAmount || isLoading}
            className="w-full bg-gradient-to-r from-[#D0B264] to-[#D0B264]/90 hover:from-[#D0B264]/90 hover:to-[#D0B264]/80 text-black font-bold py-4 text-lg rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Swapping...
              </div>
            ) : !fromAmount || !toAmount ? (
              'Enter an amount'
            ) : (
              'Swap'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
