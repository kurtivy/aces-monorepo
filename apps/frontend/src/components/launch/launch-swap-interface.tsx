'use client';

import { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface LaunchSwapInterfaceProps {
  tokenSymbol?: string;
}

export default function LaunchSwapInterface({ tokenSymbol = 'RWA' }: LaunchSwapInterfaceProps) {
  const [amount, setAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [slippage, setSlippage] = useState('0.5');

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (value) {
      setIsLoading(true);
      setTimeout(() => {
        const rate = mode === 'buy' ? 5.71 : 0.175; // RWA per ETH or ETH per RWA
        setReceiveAmount((Number.parseFloat(value) * rate).toFixed(6));
        setIsLoading(false);
      }, 300);
    } else {
      setReceiveAmount('');
    }
  };

  const handleLaunch = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl overflow-hidden h-full">
      {/* Header with Buy/Sell Toggle */}
      <div className="p-6 pb-4">
        <div className="bg-gray-800/40 rounded-2xl p-1 mb-6">
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant={mode === 'buy' ? 'default' : 'ghost'}
              onClick={() => setMode('buy')}
              className={`rounded-xl font-semibold transition-all ${
                mode === 'buy'
                  ? 'bg-gradient-to-r from-[#D0B264] to-[#D0B264]/90 text-black hover:from-[#D0B264]/90 hover:to-[#D0B264]/80'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              BUY
            </Button>
            <Button
              variant={mode === 'sell' ? 'default' : 'ghost'}
              onClick={() => setMode('sell')}
              className={`rounded-xl font-semibold transition-all ${
                mode === 'sell'
                  ? 'bg-gradient-to-r from-[#D0B264] to-[#D0B264]/90 text-black hover:from-[#D0B264]/90 hover:to-[#D0B264]/80'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              SELL
            </Button>
          </div>
        </div>

        {/* Token Balances */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between p-3 bg-gray-800/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-white">Ξ</span>
              </div>
              <span className="text-white font-semibold">ETH</span>
            </div>
            <span className="text-white font-mono">36.50 ETH</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-800/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-black">R</span>
              </div>
              <span className="text-white font-semibold">{tokenSymbol}</span>
            </div>
            <span className="text-white font-mono">0.00 {tokenSymbol}</span>
          </div>
        </div>

        <div className="text-sm text-gray-400 mb-6">Unlocked ETH: 0 ETH</div>
      </div>

      {/* Trading Interface */}
      <div className="px-6 pb-6 space-y-4">
        {/* Amount Input */}
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">PRICE</span>
            <span className="text-2xl font-bold text-white font-mono">{amount || '0'}</span>
          </div>
          <Input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="bg-transparent border-none text-lg text-gray-400 p-0 h-auto focus-visible:ring-0 font-mono"
            step="0.000001"
          />
        </div>

        {/* Receive Amount */}
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">RECEIVE AMOUNT</span>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="w-4 h-4 border-2 border-[#D0B264] border-t-transparent rounded-full animate-spin" />
              )}
              <span className="text-2xl font-bold text-white font-mono">
                {receiveAmount || '0'} {mode === 'buy' ? tokenSymbol : 'ETH'}
              </span>
            </div>
          </div>
        </div>

        {/* Slippage */}
        <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">SLIPPAGE</span>
            <span className="text-2xl font-bold text-white font-mono">{slippage}</span>
          </div>
          <div className="flex items-center justify-between">
            <Input
              type="number"
              placeholder="0.5"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="bg-transparent border-none text-lg text-gray-400 p-0 h-auto focus-visible:ring-0 font-mono w-20"
              step="0.1"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2 py-1 h-auto text-white hover:bg-gray-700/50 border-gray-600/50 rounded-lg bg-transparent"
              >
                Max
              </Button>
              <span className="text-white font-semibold">ETH</span>
            </div>
          </div>
        </div>

        {/* KYC Button */}
        <Button
          onClick={handleLaunch}
          disabled={!amount || !receiveAmount || isLoading || !acceptTerms}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-4 text-lg rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              PERFORM KYC TO UNLOCK
            </div>
          )}
        </Button>

        {/* Terms and Conditions */}
        <div className="flex items-start gap-3 p-4 bg-gray-800/20 rounded-xl">
          <Checkbox
            id="terms"
            checked={acceptTerms}
            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
            className="mt-0.5 border-gray-600 data-[state=checked]:bg-[#D0B264] data-[state=checked]:border-[#D0B264]"
          />
          <label htmlFor="terms" className="text-sm text-gray-300 cursor-pointer">
            I accept the{' '}
            <span className="text-[#D0B264] hover:underline cursor-pointer">
              Terms and Conditions
            </span>
          </label>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold mb-1">Experimental Software</p>
            <p>
              This is experimental software. Please use at your own risk and ensure you understand
              the bonding curve mechanics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
