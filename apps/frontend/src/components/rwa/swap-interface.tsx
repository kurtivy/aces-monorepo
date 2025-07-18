'use client';

import { useState } from 'react';
import { ArrowUpDown, Settings, Info, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TokenSelectorDrawer from './drawers/token-selector-drawer';

interface SwapInterfaceProps {
  tokenSymbol?: string;
}

interface Token {
  symbol: string;
  name: string;
  icon: string;
  color: string;
}

const AVAILABLE_TOKENS: Record<string, Token> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '⟠',
    color: 'from-blue-500 to-blue-400',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '$',
    color: 'from-blue-600 to-blue-500',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether',
    icon: '₮',
    color: 'from-green-600 to-green-500',
  },
};

export default function SwapInterface({ tokenSymbol = 'ACES' }: SwapInterfaceProps) {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState(tokenSymbol);
  const [isLoading, setIsLoading] = useState(false);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [showFromTokenDrawer, setShowFromTokenDrawer] = useState(false);
  const [showToTokenDrawer, setShowToTokenDrawer] = useState(false);
  const [slippageValue, setSlippageValue] = useState('0.50');
  const [isAutoSlippage, setIsAutoSlippage] = useState(true);

  const fromTokenData = AVAILABLE_TOKENS[fromToken] || {
    symbol: fromToken,
    name: fromToken,
    icon: fromToken[0],
    color: 'from-[#D0B284] to-[#D7BF75]',
  };

  const toTokenData = {
    symbol: toToken,
    name: toToken,
    icon: 'A',
    color: 'from-[#D0B284] to-[#D7BF75]',
  };

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

  const handleSlippageChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setSlippageValue(value);
      setIsAutoSlippage(false);
    }
  };

  const handleSlippageIncrement = () => {
    const currentValue = parseFloat(slippageValue);
    const newValue = Math.min(currentValue + 0.1, 100).toFixed(1);
    setSlippageValue(newValue);
    setIsAutoSlippage(false);
  };

  const handleSlippageDecrement = () => {
    const currentValue = parseFloat(slippageValue);
    const newValue = Math.max(currentValue - 0.1, 0).toFixed(1);
    setSlippageValue(newValue);
    setIsAutoSlippage(false);
  };

  const handleAutoSlippage = () => {
    setIsAutoSlippage(true);
    setSlippageValue('0.50');
  };

  const handleFromTokenSelect = (token: { symbol: string }) => {
    setFromToken(token.symbol);
    setShowFromTokenDrawer(false);
  };

  const handleToTokenSelect = (token: { symbol: string }) => {
    setToToken(token.symbol);
    setShowToTokenDrawer(false);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Main Container - Mosaic Tile */}
      <div className="bg-black border border-[#D0B284]/30 rounded-xl shadow-2xl flex-1 flex flex-col">
        {/* Header Tile */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white font-spectral uppercase tracking-wider">
              Swap
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#928357] font-mono">
              {isAutoSlippage ? 'Auto' : `${slippageValue}%`} slippage
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSlippageSettings(true)}
              className="text-[#DCDDCC] hover:text-white hover:bg-[#231F20]/50 rounded-xl"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Slippage Settings Modal */}
        {showSlippageSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#231F20] border border-[#D0B284]/30 rounded-2xl shadow-2xl w-full max-w-md">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-[#D0B284]/10">
                <h3 className="text-lg font-bold text-white">Set maximum slippage</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSlippageSettings(false)}
                  className="text-[#DCDDCC] hover:text-white hover:bg-[#231F20]/50 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="flex items-center gap-3">
                  {/* Minus Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSlippageDecrement}
                    className="w-12 h-12 bg-[#2A2627] hover:bg-[#2A2627]/80 text-white rounded-full border border-[#D0B284]/20"
                  >
                    <Minus className="w-5 h-5" />
                  </Button>

                  {/* Slippage Input Field */}
                  <div className="flex-1 bg-[#2A2627] border border-[#D0B284]/20 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        onClick={handleAutoSlippage}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          isAutoSlippage
                            ? 'bg-gradient-to-r from-[#D0B284] to-[#D7BF75] text-black'
                            : 'text-[#D0B284] hover:bg-[#D0B284]/10'
                        }`}
                      >
                        Auto
                      </Button>
                      <span className="text-2xl font-bold text-white font-mono">
                        {slippageValue}
                      </span>
                      <span className="text-white text-lg">%</span>
                    </div>
                  </div>

                  {/* Plus Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSlippageIncrement}
                    className="w-12 h-12 bg-[#2A2627] hover:bg-[#2A2627]/80 text-white rounded-full border border-[#D0B284]/20"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>

                {/* Manual Input Option */}
                {!isAutoSlippage && (
                  <div className="mt-4">
                    <Input
                      type="number"
                      value={slippageValue}
                      onChange={(e) => handleSlippageChange(e.target.value)}
                      placeholder="0.50"
                      className="bg-[#2A2627] border-[#D0B284]/20 text-white placeholder:text-[#928357] font-mono"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  </div>
                )}

                {/* Quick Presets */}
                <div className="mt-4 flex gap-2">
                  {['0.1', '0.5', '1.0', '2.0'].map((preset) => (
                    <Button
                      key={preset}
                      variant="ghost"
                      onClick={() => {
                        setSlippageValue(preset);
                        setIsAutoSlippage(false);
                      }}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        slippageValue === preset && !isAutoSlippage
                          ? 'bg-gradient-to-r from-[#D0B284] to-[#D7BF75] text-black'
                          : 'text-[#D0B284] hover:bg-[#D0B284]/10'
                      }`}
                    >
                      {preset}%
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-black">
          {/* Connected Swap Sections */}
          <div className="relative">
            {/* Main container with connected sections */}
            <div className="bg-[#231F20]/50 backdrop-blur-sm rounded-2xl border border-[#D0B284]/20 hover:border-[#D0B284]/30 transition-colors">
              {/* From Token Section - Top Tile */}
              <div className="p-4 pb-6 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[#DCDDCC] font-mono">You pay</span>
                  <div className="flex items-center gap-2 text-sm text-[#928357]">
                    <span className="font-mono">Balance: 2.45</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs px-2 py-1 h-auto text-[#D0B284] hover:bg-[#D0B284]/10 rounded-lg font-medium"
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
                      className="bg-transparent border-none text-2xl font-bold text-white placeholder:text-[#928357] p-0 h-auto focus-visible:ring-0 font-mono"
                      step="0.000001"
                    />
                    <div className="text-sm text-[#928357] mt-1 font-mono">
                      ${fromAmount ? (Number.parseFloat(fromAmount) * 3420).toFixed(2) : '0.00'}
                    </div>
                  </div>

                  <div className="relative">
                    <Button
                      onClick={() => setShowFromTokenDrawer(true)}
                      variant="outline"
                      className="bg-[#231F20] border-[#D0B284]/30 text-white hover:bg-[#231F20]/80 font-medium px-4 py-3 rounded-2xl backdrop-blur-sm shrink-0 h-auto"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 bg-gradient-to-r ${fromTokenData.color} rounded-full flex items-center justify-center`}
                        >
                          <span className="text-sm font-bold text-white">{fromTokenData.icon}</span>
                        </div>
                        <span className="font-semibold">{fromToken}</span>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Divider line with notch for swap button */}
              <div className="relative">
                <div className="border-t border-[#D0B284]/20 mx-4"></div>
                {/* Carved out space for swap button */}
                <div className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-12 h-6 bg-[#231F20]/50 rounded-full"></div>
                </div>
              </div>

              {/* To Token Section - Bottom Tile */}
              <div className="p-4 pt-6 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[#DCDDCC] font-mono">You receive</span>
                  <div className="text-sm text-[#928357] font-mono">Balance: 0.00</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      placeholder="0"
                      value={toAmount}
                      readOnly
                      className="bg-transparent border-none text-2xl font-bold text-white placeholder:text-[#928357] p-0 h-auto focus-visible:ring-0 font-mono"
                    />
                    {isLoading && (
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-5 h-5 border-2 border-[#D0B284] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <div className="text-sm text-[#928357] mt-1 font-mono">
                      ${toAmount ? (Number.parseFloat(toAmount) * 83333).toFixed(2) : '0.00'}
                    </div>
                  </div>

                  <div className="relative">
                    <Button
                      onClick={() => setShowToTokenDrawer(true)}
                      variant="outline"
                      className="bg-[#231F20] border-[#D0B284]/30 text-white hover:bg-[#231F20]/80 font-medium px-4 py-3 rounded-2xl backdrop-blur-sm shrink-0 h-auto"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 bg-gradient-to-r ${toTokenData.color} rounded-full flex items-center justify-center`}
                        >
                          <span className="text-sm font-bold text-black">{toTokenData.icon}</span>
                        </div>
                        <span className="font-semibold">{toToken}</span>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Swap Button positioned in the carved-out notch */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 border border-[#D0B284]/30 rounded-xl">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapTokens}
                className="bg-black hover:bg-[#231F20]/80 border-4 border-[#231F20] hover:border-[#D0B284]/20 rounded-xl w-10 h-10 backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg"
              >
                <ArrowUpDown className="h-5 w-5 text-[#D0B284] hover:text-[#D0B284] transition-colors" />
              </Button>
            </div>
          </div>

          {/* Swap Button Tile */}
          <div className="flex justify-center items-center px-12">
            <Button
              onClick={handleSwap}
              disabled={!fromAmount || !toAmount || isLoading}
              className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-6 text-lg rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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

        {/* Fixed Transaction Details Tile - Always Visible */}
        <div className="bg-[#231F20]/50 p-4 border-t rounded-t-xl border-[#D0B284]/10 mt-auto">
          <div className="flex items-center justify-between text-sm mb-2">
            <div className="flex items-center gap-1 text-[#DCDDCC]">
              <span>Rate</span>
              <Info className="w-3 h-3" />
            </div>
            <span className="text-white font-mono">
              {fromAmount && toAmount
                ? `1 ${fromToken} = ${fromToken === 'ETH' ? '83,333' : '0.000012'} ${toToken}`
                : `1 ${fromToken} = -- ${toToken}`}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#DCDDCC]">Price impact</span>
            <span className="text-green-400">{fromAmount && toAmount ? '<0.01%' : '--'}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-[#DCDDCC]">Network fee</span>
            <span className="text-white font-mono">~$2.50</span>
          </div>
        </div>
      </div>

      {/* Token Selector Drawers */}
      <TokenSelectorDrawer
        isOpen={showFromTokenDrawer}
        onClose={() => setShowFromTokenDrawer(false)}
        onTokenSelect={handleFromTokenSelect}
      />

      <TokenSelectorDrawer
        isOpen={showToTokenDrawer}
        onClose={() => setShowToTokenDrawer(false)}
        onTokenSelect={handleToTokenSelect}
      />
    </div>
  );
}
