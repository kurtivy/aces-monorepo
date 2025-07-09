'use client';

import { TrendingUp, Users, Droplets, Activity } from 'lucide-react';
import { useState } from 'react';

interface TokenInformationProps {
  tokenPrice?: number;
  priceChange?: {
    '5m': number;
    '1h': number;
    '6h': number;
    '1d': number;
  };
  fdv?: string;
  holders?: number;
  liquidity?: string;
  volume?: {
    '5m': string;
    '1h': string;
    '6h': string;
    '1d': string;
  };
  transactions?: {
    '5m': {
      buys: number;
      sells: number;
      makers: number;
      buyers: number;
      sellers: number;
    };
    '1h': {
      buys: number;
      sells: number;
      makers: number;
      buyers: number;
      sellers: number;
    };
    '6h': {
      buys: number;
      sells: number;
      makers: number;
      buyers: number;
      sellers: number;
    };
    '1d': {
      buys: number;
      sells: number;
      makers: number;
      buyers: number;
      sellers: number;
    };
  };
}

export default function TokenInformation({
  tokenPrice = 0.01884,
  priceChange = {
    '5m': 0.04,
    '1h': -6.31,
    '6h': -6.26,
    '1d': -5.24,
  },
  fdv = '$18.74m',
  holders = 26261,
  liquidity = '$864.13k',
  volume = {
    '5m': '$45.19k',
    '1h': '$145.19k',
    '6h': '$245.19k',
    '1d': '$345.19k',
  },
  transactions = {
    '5m': {
      buys: 1404,
      sells: 170,
      makers: 1378,
      buyers: 1263,
      sellers: 115,
    },
    '1h': {
      buys: 2804,
      sells: 340,
      makers: 2756,
      buyers: 2526,
      sellers: 230,
    },
    '6h': {
      buys: 5608,
      sells: 680,
      makers: 5512,
      buyers: 5052,
      sellers: 460,
    },
    '1d': {
      buys: 11216,
      sells: 1360,
      makers: 11024,
      buyers: 10104,
      sellers: 920,
    },
  },
}: TokenInformationProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'5m' | '1h' | '6h' | '1d'>('1h');
  const currentTransactions = transactions[selectedTimeframe];
  const currentVolume = volume[selectedTimeframe];

  return (
    <div className="h-full px-0 py-4 flex flex-col gap-3">
      {/* Token Price and Volume */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400">Price</div>
          <div className="text-3xl font-mono font-bold text-white">${tokenPrice.toFixed(5)}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400">{selectedTimeframe} Volume</div>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-[#D0B264]" />
            <span className="text-sm font-mono text-white">{currentVolume}</span>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2">
        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3 w-3 text-[#D0B264]" />
            <span className="text-xs text-gray-400">FDV</span>
          </div>
          <span className="font-mono text-white text-sm">{fdv}</span>
        </div>

        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <div className="flex items-center gap-1.5 mb-1">
            <Droplets className="h-3 w-3 text-[#D0B264]" />
            <span className="text-xs text-gray-400">Liquidity</span>
          </div>
          <span className="font-mono text-white text-sm">{liquidity}</span>
        </div>

        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3 w-3 text-[#D0B264]" />
            <span className="text-xs text-gray-400">Holders</span>
          </div>
          <span className="font-mono text-white text-sm">{holders.toLocaleString()}</span>
        </div>

        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3 w-3 text-[#D0B264]" />
            <span className="text-xs text-gray-400">24h Vol</span>
          </div>
          <span className="font-mono text-white text-sm">{volume['1d']}</span>
        </div>
      </div>

      {/* Time-based Price Changes */}
      <div className="grid grid-cols-4 ">
        {Object.entries(priceChange).map(([time, change]) => (
          <button
            key={time}
            onClick={() => setSelectedTimeframe(time as '5m' | '1h' | '6h' | '1d')}
            className={`bg-white/5 rounded-lg p-1.5 text-center border transition-colors ${
              selectedTimeframe === time
                ? 'border-emerald-400/50 bg-emerald-400/10'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            <div className="text-xs mb-0.5 text-white">{time}</div>
            <div
              className={`text-xs font-mono font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {change >= 0 ? '+' : ''}
              {change}%
            </div>
          </button>
        ))}
      </div>

      {/* Transaction Distribution */}
      <div className="mt-auto px-4 pb-4">
        {/* Buy/Sell Distribution */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <div>
              <span className="text-gray-400">Txns </span>
              <span className="text-white font-mono">
                {currentTransactions.buys + currentTransactions.sells}
              </span>
            </div>
            <div className="flex gap-3">
              <div>
                <span className="text-emerald-400">Buys </span>
                <span className="text-white font-mono">{currentTransactions.buys}</span>
              </div>
              <div>
                <span className="text-red-400">Sells </span>
                <span className="text-white font-mono">{currentTransactions.sells}</span>
              </div>
            </div>
          </div>
          <div className="relative h-1.5 rounded-full overflow-hidden">
            <div className="absolute inset-0 flex">
              <div
                className="h-full bg-emerald-400"
                style={{
                  width: `${(currentTransactions.buys / (currentTransactions.buys + currentTransactions.sells)) * 100}%`,
                }}
              />
              <div
                className="h-full bg-red-400"
                style={{
                  width: `${(currentTransactions.sells / (currentTransactions.buys + currentTransactions.sells)) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
