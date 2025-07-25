"use client"

import { TrendingUp, Users, Droplets, Activity } from "lucide-react"
import { useState } from "react"

interface TokenInformationProps {
  tokenPrice?: number
  priceChange?: {
    "5m": number
    "1h": number
    "6h": number
    "1d": number
  }
  fdv?: string
  holders?: number
  liquidity?: string
  volume?: {
    "5m": string
    "1h": string
    "6h": string
    "1d": string
  }
  transactions?: {
    "5m": {
      buys: number
      sells: number
      makers: number
      buyers: number
      sellers: number
    }
    "1h": {
      buys: number
      sells: number
      makers: number
      buyers: number
      sellers: number
    }
    "6h": {
      buys: number
      sells: number
      makers: number
      buyers: number
      sellers: number
    }
    "1d": {
      buys: number
      sells: number
      makers: number
      buyers: number
      sellers: number
    }
  }
}

export default function TokenInformation({
  tokenPrice = 0.01884,
  priceChange = {
    "5m": 0.04,
    "1h": -6.31,
    "6h": -6.26,
    "1d": -5.24,
  },
  fdv = "$18.74m",
  holders = 26261,
  liquidity = "$864.13k",
  volume = {
    "5m": "$45.19k",
    "1h": "$145.19k",
    "6h": "$245.19k",
    "1d": "$345.19k",
  },
  transactions = {
    "5m": {
      buys: 1404,
      sells: 170,
      makers: 1378,
      buyers: 1263,
      sellers: 115,
    },
    "1h": {
      buys: 2804,
      sells: 340,
      makers: 2756,
      buyers: 2526,
      sellers: 230,
    },
    "6h": {
      buys: 5608,
      sells: 680,
      makers: 5512,
      buyers: 5052,
      sellers: 460,
    },
    "1d": {
      buys: 11216,
      sells: 1360,
      makers: 11024,
      buyers: 10104,
      sellers: 920,
    },
  },
}: TokenInformationProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<"5m" | "1h" | "6h" | "1d">("1h")
  const currentTransactions = transactions[selectedTimeframe]
  const currentVolume = volume[selectedTimeframe]

  return (
    <div className="bg-black rounded-xl overflow-hidden">
      <div className="flex flex-col w-full space-y-6">
        {/* Right Column Content - Now First (Time-based Changes and Transaction Distribution) */}
        <div className="w-full bg-[#231F20] rounded-xl p-6">
          {/* Time-based Price Changes */}
          <div className="mb-6">
            <div className="flex flex-row">
              {Object.entries(priceChange).map(([time, change]) => (
                <button
                  key={time}
                  onClick={() => setSelectedTimeframe(time as "5m" | "1h" | "6h" | "1d")}
                  className={`flex-1 rounded-xl p-2 text-center border transition-all duration-200 shadow-sm bg-[#231F20]/50 ${
                    selectedTimeframe === time
                      ? "border-[#184D37] bg-[#184D37]/50 shadow-[#184D37]/20"
                      : "border-[#D0B284]/20 hover:border-[#D0B284]/40 hover:bg-[#D0B284]/5"
                  }`}
                >
                  <div className="text-xs mb-1 text-[#D0B284] font-mono font-medium">{time}</div>
                  <div className={`text-xs font-mono font-bold ${change >= 0 ? "text-[#184D37]" : "text-red-400"}`}>
                    {change >= 0 ? "+" : ""}
                    {change}%
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Distribution */}
          <div className="space-y-6">
            <div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[#DCDDCC]">Total Txns </span>
                    <span className="text-white font-mono font-medium">
                      {currentTransactions.buys + currentTransactions.sells}
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[#184D37]">Buys </span>
                      <span className="text-white font-mono font-medium">{currentTransactions.buys}</span>
                    </div>
                    <div>
                      <span className="text-red-400]">Sells </span>
                      <span className="text-white font-mono font-medium">{currentTransactions.sells}</span>
                    </div>
                  </div>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden bg-black/40 pb-0.5">
                  <div className="absolute inset-0 flex pb-0.5">
                    <div
                      className="h-full bg-[#184D37] shadow-sm"
                      style={{
                        width: `${(currentTransactions.buys / (currentTransactions.buys + currentTransactions.sells)) * 100}%`,
                      }}
                    />
                    <div
                      className="h-full bg-red-400 shadow-sm"
                      style={{
                        width: `${(currentTransactions.sells / (currentTransactions.buys + currentTransactions.sells)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Makers Distribution */}
            <div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[#DCDDCC]">Makers </span>
                    <span className="text-white font-mono font-medium">{currentTransactions.makers}</span>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-[#184D37]">Buyers </span>
                      <span className="text-white font-mono font-medium">{currentTransactions.buyers}</span>
                    </div>
                    <div>
                      <span className="text-red-400">Sellers </span>
                      <span className="text-white font-mono font-medium">{currentTransactions.sellers}</span>
                    </div>
                  </div>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden bg-black/40">
                  <div className="absolute inset-0 flex">
                    <div
                      className="h-full bg-[#184D37] shadow-sm"
                      style={{
                        width: `${(currentTransactions.buyers / (currentTransactions.buyers + currentTransactions.sellers)) * 100}%`,
                      }}
                    />
                    <div
                      className="h-full bg-red-400 shadow-sm"
                      style={{
                        width: `${(currentTransactions.sellers / (currentTransactions.buyers + currentTransactions.sellers)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Left Column Content - Now Second (Price and Key Metrics) */}
        <div className="w-full">
          {/* Token Price Header */}
          <div className="w-full border-b border-[#D0B284]/30 rounded-b-xl shadow-lg shadow-black/20 mb-4">
            <div className="flex items-center justify-between p-2.5 px-6 bg-[#231F20] border border-[#D0B284]/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="text-xs text-[#DCDDCC] font-mono">Price</div>
                <div className="text-2xl font-bold text-white font-mono">${tokenPrice.toFixed(5)}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-[#D0B284]" />
                <span className="text-xs text-[#DCDDCC] font-mono">{selectedTimeframe} Volume:</span>
                <span className="text-sm font-mono text-white">{currentVolume}</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#231F20]/50 border border-[#D0B284]/30 shadow-md shadow-black/15 rounded-xl">
              <div className="p-2 text-center">
                <div className="flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-[#D0B284]" />
                  <span className="text-xs text-[#DCDDCC] font-mono">FDV</span>
                </div>
                <span className="font-mono text-white text-sm font-medium">{fdv}</span>
              </div>
            </div>

            <div className="bg-[#231F20]/50 border border-[#D0B284]/30 shadow-md shadow-black/15 rounded-xl">
              <div className="p-2 text-center">
                <div className="flex items-center justify-center">
                  <Droplets className="h-4 w-4 text-[#D0B284]" />
                  <span className="text-xs text-[#DCDDCC] font-mono">Liquidity</span>
                </div>
                <span className="font-mono text-white text-sm font-medium">{liquidity}</span>
              </div>
            </div>

            <div className="bg-[#231F20]/50 border border-[#D0B284]/30 shadow-md shadow-black/15 rounded-xl">
              <div className="p-2 text-center">
                <div className="flex items-center justify-center">
                  <Users className="h-4 w-4 text-[#D0B284]" />
                  <span className="text-xs text-[#DCDDCC] font-mono">Holders</span>
                </div>
                <span className="font-mono text-white text-sm font-medium">{holders.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[#231F20]/50 border border-[#D0B284]/30 shadow-md shadow-black/15 rounded-xl">
              <div className="p-2 text-center">
                <div className="flex items-center justify-center">
                  <Activity className="h-4 w-4 text-[#D0B284]" />
                  <span className="text-xs text-[#DCDDCC] font-mono">24h Vol</span>
                </div>
                <span className="font-mono text-white text-sm font-medium">{volume["1d"]}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
