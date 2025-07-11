'use client';

import BondingCurveChart from './bonding-curve-chart';
import LaunchSwapInterface from './launch-swap-interface';

interface TokenLaunchPageProps {
  tokenSymbol?: string;
  tokenName?: string;
}

export default function TokenLaunchPage({
  tokenSymbol = 'RWA',
  tokenName = 'Real World Assets',
}: TokenLaunchPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 rounded-2xl flex items-center justify-center">
                <span className="text-xl font-bold text-black">R</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{tokenName}</h1>
                <p className="text-gray-400">Token Launch • {tokenSymbol}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Current Price</div>
              <div className="text-2xl font-bold text-[#D0B264] font-mono">0.175 ETH</div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <p className="text-center text-amber-200 text-sm">
            The contracts supporting {tokenName} were audited. However, it is still experimental
            software. Please use at your own risk.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
          {/* Left Column - Bonding Curve Chart */}
          <div className="order-2 lg:order-1">
            <BondingCurveChart />
          </div>

          {/* Right Column - Launch Interface */}
          <div className="order-1 lg:order-2">
            <LaunchSwapInterface tokenSymbol={tokenSymbol} />
          </div>
        </div>
      </div>
    </div>
  );
}
