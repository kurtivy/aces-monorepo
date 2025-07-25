'use client';

import { useState } from 'react';
import { ArrowUpDown, Settings, Info, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TokenSelectorDrawer from './drawers/token-selector-drawer';
import Image from 'next/image';

interface SwapInterfaceProps {
  tokenSymbol?: string;
}

interface Token {
  symbol: string;
  name: string;
  icon: string;
  color?: string;
}

const AVAILABLE_TOKENS: Record<string, Token> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '/svg/eth.svg',
    color: 'invert brightness-200',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '/svg/usdc.svg',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether',
    icon: '/svg/tether.svg',
    color: 'invert brightness-200',
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
  const [slippageValue, setSlippageValue] = useState('2.50');
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
    icon: '/aces-logo.png',
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

  const handleAutoSlippage = () => {
    setIsAutoSlippage(true);
    setSlippageValue('2.50');
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
            <h2 className="text-xl font-bold text-white font-system uppercase tracking-wider">
              Swap
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#928357] font-mono">
              {isAutoSlippage ? 'Auto' : `${slippageValue}%`}
            </span>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                className="text-[#DCDDCC] hover:text-white hover:bg-[#231F20]/50 rounded-xl"
              >
                <Settings className="w-5 h-5" />
              </Button>

              {/* Slippage Settings Dropdown */}
              {showSlippageSettings && (
                <div className="absolute top-full right-0 mt-2 z-50">
                  <div className="bg-[#231F20] border border-[#D0B284]/30 rounded-xl shadow-2xl w-64">
                    {/* Dropdown Content */}
                    <div className="p-3">
                      <span className="text-sm font-bold text-[#D0B284] font-mono">Slippage</span>
                      {/* Slippage Display */}
                      <div className="bg-[#2A2627] border border-[#D0B284]/20 rounded-lg p-2 flex items-center justify-center mb-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            onClick={handleAutoSlippage}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              isAutoSlippage
                                ? 'bg-gradient-to-r from-[#D0B284] to-[#D7BF75] text-black'
                                : 'text-[#D0B284] hover:bg-[#D0B284]/10'
                            }`}
                          >
                            Auto
                          </Button>
                          <Input
                            type="number"
                            value={slippageValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (
                                value &&
                                !isNaN(parseFloat(value)) &&
                                parseFloat(value) >= 0 &&
                                parseFloat(value) <= 100
                              ) {
                                setSlippageValue(value);
                                setIsAutoSlippage(false);
                              }
                            }}
                            className="w-16 bg-transparent border-none text-sm font-bold text-white font-mono p-0 text-center focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:border-transparent focus-visible:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&>input]:text-white [&>input]:focus-visible:text-white"
                            step="0.1"
                            min="0"
                            max="100"
                          />
                          <span className="text-white text-sm">%</span>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex gap-2">
                        {['0.5', '1.0', '2.0'].map((preset) => (
                          <Button
                            key={preset}
                            variant="ghost"
                            onClick={() => {
                              setSlippageValue(preset);
                              setIsAutoSlippage(false);
                            }}
                            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
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
            </div>
          </div>
        </div>

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
                      className="bg-transparent border-none text-2xl font-bold text-white placeholder:text-[#928357] p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:border-transparent focus-visible:text-white font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&>input]:text-white [&>input]:focus-visible:text-white"
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
                      className="bg-[#231F20] border-[#D0B284]/30 text-white hover:bg-[#231F20]/80 hover:text-[#D0B284]/80 font-medium px-4 py-3 rounded-2xl backdrop-blur-sm shrink-0 h-auto"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 bg-gradient-to-r ${fromTokenData.color} rounded-full flex items-center justify-center`}
                        >
                          <Image
                            src={fromTokenData.icon}
                            alt={fromTokenData.name}
                            width={20}
                            height={20}
                            className="w-5 h-5"
                          />
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
                      className="bg-transparent border-none text-2xl font-bold text-white placeholder:text-[#928357] p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:border-transparent focus-visible:text-white font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&>input]:text-white [&>input]:focus-visible:text-white"
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
                      className="bg-[#231F20] border-[#D0B284]/30 text-white hover:bg-[#231F20]/80 hover:text-[#D0B284]/80 font-medium px-4 py-3 rounded-2xl backdrop-blur-sm shrink-0 h-auto"
                    >
                      <div className="flex items-center gap-2">
                        <Image
                          src={toTokenData.icon}
                          alt={toTokenData.name}
                          width={20}
                          height={20}
                          className="w-6 h-6"
                        />

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
                <div className="flex items-center gap-2 tracking-widest font-bold">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin " />
                  Swapping...
                </div>
              ) : (
                'SWAP'
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
