'use client';

import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';

// Bonding curve data - exponential curve
const bondingCurveData = [
  { supply: 0, price: 0.01 },
  { supply: 2, price: 0.015 },
  { supply: 4, price: 0.025 },
  { supply: 6, price: 0.04 },
  { supply: 8, price: 0.065 },
  { supply: 10, price: 0.1 },
  { supply: 12, price: 0.15 },
  { supply: 14, price: 0.22 },
  { supply: 16, price: 0.32 },
  { supply: 18, price: 0.45 },
  { supply: 20, price: 0.62 },
  { supply: 22, price: 0.82 },
  { supply: 24, price: 1.05 },
  { supply: 26, price: 1.32 },
];

const currentSupply = 12.5;
const currentPrice = 0.175;

export default function BondingCurveChart() {
  return (
    <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl overflow-hidden h-full">
      {/* Stats Header */}
      <div className="p-6 border-b border-gray-800/50">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Buy Price</div>
            <div className="text-lg font-bold text-white font-mono">0.175 ETH</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Reserve</div>
            <div className="text-lg font-bold text-white font-mono">8.42 ETH</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Curve Issuance</div>
            <div className="text-lg font-bold text-white font-mono">12,500</div>
            <div className="text-xs text-[#D0B264]">RWA</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">Total Supply</div>
            <div className="text-lg font-bold text-white font-mono">25,000</div>
            <div className="text-xs text-[#D0B264]">RWA</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white mb-2">Bonding Curve</h3>
          <p className="text-sm text-gray-400">Price increases as more tokens are purchased</p>
        </div>

        <ChartContainer
          config={{
            price: {
              label: 'Price (ETH)',
              color: 'hsl(var(--chart-1))',
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={bondingCurveData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="supply"
                stroke="#9CA3AF"
                fontSize={12}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                axisLine={false}
                tickLine={false}
                domain={[0, 1.4]}
              />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
                        <p className="text-white font-mono text-sm">Supply: {label} RWA</p>
                        <p className="text-[#D0B264] font-mono text-sm">
                          Price: {payload[0].value} ETH
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Main bonding curve */}
              <Line
                type="monotone"
                dataKey="price"
                stroke="url(#bondingGradient)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#D0B264' }}
              />

              {/* Current price indicator */}
              <ReferenceLine
                x={currentSupply}
                stroke="#D0B264"
                strokeDasharray="2 2"
                label={{
                  value: `Current: ${currentPrice} ETH`,
                  position: 'top',
                  fill: '#D0B264',
                  fontSize: 12,
                }}
              />

              {/* Pre-sale price indicator */}
              <ReferenceLine
                y={0.1}
                stroke="#10B981"
                strokeDasharray="2 2"
                label={{
                  value: 'Pre-sale: 0.1 ETH',
                  position: 'left',
                  fill: '#10B981',
                  fontSize: 12,
                }}
              />

              {/* Current position dot */}
              <Dot
                cx={currentSupply}
                cy={currentPrice}
                r={4}
                fill="#D0B264"
                stroke="#000"
                strokeWidth={2}
              />

              <defs>
                <linearGradient id="bondingGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="50%" stopColor="#D0B264" />
                  <stop offset="100%" stopColor="#EF4444" />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Chart Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-400">Early Stage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#D0B264] rounded-full"></div>
            <span className="text-gray-400">Current Price</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-400">Premium Stage</span>
          </div>
        </div>
      </div>
    </div>
  );
}
