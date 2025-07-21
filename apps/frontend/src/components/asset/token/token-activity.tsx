'use client';
import { useState } from 'react';
import { ShoppingBag, Zap, TrendingUp, ExternalLink, Filter } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ActivityEvent {
  event: string;
  price: number;
  from: string;
  to: string;
  time: string;
}

interface Holder {
  rank: number;
  address: string;
  percentage: number;
  amount: number;
  value: number;
  txns: number;
  exp: string;
}

interface TokenActivityProps {
  activity: ActivityEvent[];
  holders: Holder[];
  className?: string;
}

// Utility function to truncate addresses
const truncateAddress = (address: string, startLength = 6, endLength = 4): string => {
  if (address.length <= startLength + endLength + 3) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

export default function TokenActivity({
  activity = [],
  holders = [],
  className = '',
}: TokenActivityProps) {
  const [activeTab, setActiveTab] = useState<'activity' | 'holders'>('activity');

  return (
    <div
      className={`bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20 shadow-lg ${className}`}
    >
      {/* Tab Buttons - Updated to match your design */}
      <div className="flex w-full bg-transparent p-0 border-b border-[#D0B284]/30 mb-6">
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 pb-3 text-center font-mono font-medium transition-all duration-200 relative ${
            activeTab === 'activity'
              ? 'text-[#D0B284] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-[#D0B284] after:rounded-t-sm'
              : 'text-[#DCDDCC] hover:text-white'
          }`}
        >
          Activity
        </button>
        <button
          onClick={() => setActiveTab('holders')}
          className={`flex-1 pb-3 text-center font-mono font-medium transition-all duration-200 relative ${
            activeTab === 'holders'
              ? 'text-[#D0B284] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-[#D0B284] after:rounded-t-sm'
              : 'text-[#DCDDCC] hover:text-white'
          }`}
        >
          Holders
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'activity' ? (
          <div className="flex flex-col h-full max-h-96">
            <div className="flex-1 overflow-y-auto min-h-0">
              <Table>
                <TableHeader className="sticky top-0 bg-[#231F20] z-10">
                  <TableRow className="border-b border-[#D0B284]/20">
                    <TableHead className="text-[#D0B284] font-mono text-xs">EVENT</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs">PRICE</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs">FROM</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs">TO</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs text-right">
                      TIME
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.length > 0 ? (
                    activity.map((item, index) => (
                      <TableRow
                        key={index}
                        className="border-b border-[#D0B284]/10 hover:bg-black/10"
                      >
                        <TableCell className="text-white font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {item.event === 'Mint' ? (
                              <Zap className="h-4 w-4 text-[#D0B284]" />
                            ) : item.event === 'Bid' ? (
                              <TrendingUp className="h-4 w-4 text-[#D0B284]" />
                            ) : (
                              <ShoppingBag className="h-4 w-4 text-[#D0B284]" />
                            )}
                            <span>{item.event}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-white font-mono text-sm">
                          {item.price} ETH
                        </TableCell>
                        <TableCell className="text-white font-mono text-sm">{item.from}</TableCell>
                        <TableCell className="text-white font-mono text-sm">{item.to}</TableCell>
                        <TableCell className="text-right">
                          <a
                            href="#"
                            className="flex items-center gap-1 text-[#DCDDCC] hover:text-[#D0B284] font-mono text-xs justify-end transition-colors"
                          >
                            {item.time} <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-[#DCDDCC] py-8">
                        No activity to display.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full max-h-96">
            <div className="flex-1 overflow-y-auto min-h-0">
              <Table>
                <TableHeader className="sticky top-0 bg-[#231F20] z-10">
                  <TableRow className="border-b border-[#D0B284]/20">
                    <TableHead className="text-[#D0B284] font-mono text-xs">RANK</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs">ADDRESS</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs">%</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs">AMOUNT</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs">VALUE</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs">TXNS</TableHead>
                    <TableHead className="text-[#D0B284] font-mono text-xs text-right">
                      EXP
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holders.length > 0 ? (
                    holders.map((holder) => (
                      <TableRow
                        key={holder.rank}
                        className="border-b border-[#D0B284]/10 hover:bg-black/10"
                      >
                        <TableCell className="text-[#DCDDCC] font-mono text-sm py-3">
                          #{holder.rank}
                        </TableCell>
                        <TableCell className="text-white font-mono text-sm">
                          {truncateAddress(holder.address)}
                        </TableCell>
                        <TableCell className="text-white font-mono text-sm">
                          {holder.percentage.toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono text-sm">
                              {holder.amount.toLocaleString()}M
                            </span>
                            <div className="w-24 bg-[#184D37]/50 rounded-full h-2">
                              <div
                                className="bg-[#D0B284] h-full rounded-full"
                                style={{ width: `${(holder.amount / 1000) * 100}%` }}
                              />
                            </div>
                            <span className="text-[#DCDDCC] font-mono text-sm">999.9M</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-white font-bold font-mono text-sm">
                          ${holder.value.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[#DCDDCC] font-mono text-sm">
                          {holder.txns}
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            href="#"
                            className="inline-flex items-center gap-1 text-[#DCDDCC] hover:text-[#D0B284] font-mono text-xs transition-colors"
                          >
                            <Filter className="h-3 w-3" /> <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-[#DCDDCC] py-8">
                        No holders to display.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
