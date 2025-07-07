'use client';

import { TrendingUp, TrendingDown, Users, Droplets, Activity, Clock } from 'lucide-react';

interface TokenInformationProps {
  tokenSymbol?: string;
  tokenPrice?: number;
  priceChange24h?: number;
  fdv?: string;
  holders?: number;
  liquidity?: string;
  volume24h?: string;
  recentTransactions?: Array<{
    type: 'buy' | 'sell';
    amount: string;
    price: string;
    time: string;
    hash: string;
  }>;
}

export default function TokenInformation({
  tokenSymbol = 'RWA',
  tokenPrice = 0.02734,
  priceChange24h = 12.65,
  fdv = '$2.1M',
  holders = 1247,
  liquidity = '$156K',
  volume24h = '$89.2K',
  recentTransactions = [
    { type: 'buy', amount: '1,250', price: '0.02745', time: '2m ago', hash: '0x1234...5678' },
    { type: 'sell', amount: '890', price: '0.02738', time: '4m ago', hash: '0x8765...4321' },
    { type: 'buy', amount: '2,100', price: '0.02742', time: '7m ago', hash: '0x9876...1234' },
    { type: 'buy', amount: '567', price: '0.02739', time: '12m ago', hash: '0x5432...8765' },
    { type: 'sell', amount: '1,890', price: '0.02735', time: '18m ago', hash: '0x2468...1357' },
  ],
}: TokenInformationProps) {
  const isPositive = priceChange24h >= 0;

  return (
    <div className="space-y-4">
      {/* Token Price Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Token Information</h3>
        <div
          className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}
        >
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span className="text-sm font-medium">
            {isPositive ? '+' : ''}
            {priceChange24h.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Current Price */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-sm text-gray-400 mb-1">${tokenSymbol} Price</div>
        <div className="text-2xl font-bold text-white font-mono">${tokenPrice.toFixed(5)}</div>
      </div>

      {/* Key Metrics - Compact List */}
      <div className="space-y-2">
        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#D0B264]" />
            <span className="text-sm text-gray-400">FDV</span>
          </div>
          <span className="font-mono text-white">{fdv}</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#D0B264]" />
            <span className="text-sm text-gray-400">Holders</span>
          </div>
          <span className="font-mono text-white">{holders.toLocaleString()}</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-[#D0B264]" />
            <span className="text-sm text-gray-400">Liquidity</span>
          </div>
          <span className="font-mono text-white">{liquidity}</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#D0B264]" />
            <span className="text-sm text-gray-400">24h Volume</span>
          </div>
          <span className="font-mono text-white">{volume24h}</span>
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-[#D0B264]" />
          <h4 className="text-sm font-semibold text-[#D0B264]">Recent Transactions</h4>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {recentTransactions.map((tx, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${tx.type === 'buy' ? 'bg-green-400' : 'bg-red-400'}`}
                />
                <div>
                  <div className="text-xs font-medium text-white">
                    {tx.type === 'buy' ? 'Buy' : 'Sell'} {tx.amount}
                  </div>
                  <div className="text-xs text-gray-400">{tx.time}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-white">${tx.price}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
