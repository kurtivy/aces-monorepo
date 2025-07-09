'use client';

import { Gavel, TrendingUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Bid {
  id: string;
  bidder: string;
  amount: number;
  timestamp: string;
  isWinning?: boolean;
}

interface BiddingSystemProps {
  currentHighestBid?: number;
  minimumBid?: number;
  totalBids?: number;
  bids?: Bid[];
}

export default function BidsSection({
  currentHighestBid = 2.5,
  totalBids = 12,
  bids = [
    { id: '1', bidder: '0x1234...5678', amount: 2.5, timestamp: '2 min ago', isWinning: true },
    { id: '2', bidder: '0x8765...4321', amount: 2.3, timestamp: '5 min ago' },
    { id: '3', bidder: '0x9876...1234', amount: 2.1, timestamp: '8 min ago' },
    { id: '4', bidder: '0x5432...8765', amount: 1.9, timestamp: '12 min ago' },
    { id: '5', bidder: '0x2468...1357', amount: 1.7, timestamp: '15 min ago' },
  ],
}: BiddingSystemProps) {
  const handleGoToBidding = () => {
    // Navigate to full bidding page
    console.log('Navigate to bidding page');
  };

  return (
    <div className="h-full flex flex-col space-y-3 bg-[#928357] text-white">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[#D0B264]">Bids</h3>
        <div className="flex items-center gap-1 text-green-400">
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs font-medium">{totalBids}</span>
        </div>
      </div>

      {/* Compact Current Bid Info */}
      <div className="bg-black/20 rounded-md border border-[#D0B264]/30">
        <div className="text-xs text-gray-300 mb-1">Top Bid</div>
        <div className="text-lg font-bold text-white font-mono mb-1">
          {currentHighestBid.toFixed(2)} ETH
        </div>
        <div className="text-xs text-gray-400">≈ ${(currentHighestBid * 2400).toFixed(0)}</div>
      </div>

      {/* Compact Place Bid Button */}
      <Button
        onClick={handleGoToBidding}
        className="w-full bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-semibold py-2 text-xs transition-all duration-200"
        size="sm"
      >
        <Gavel className="h-3 w-3 mr-1" />
        Place Bid
      </Button>

      {/* Compact Recent Bids */}
      <div className="flex-1 flex flex-col min-h-0">
        <h4 className="text-xs font-semibold text-[#D0B264] mb-2">Recent</h4>
        <div className="flex-1 overflow-y-auto space-y-1">
          {bids.slice(0, 4).map((bid) => (
            <div
              key={bid.id}
              className={`flex items-center justify-between p-2 rounded-md transition-colors border ${
                bid.isWinning
                  ? 'bg-green-500/20 border-green-500/40'
                  : 'bg-black/10 border-white/10 hover:bg-black/20'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Avatar className="h-4 w-4 flex-shrink-0">
                  <AvatarFallback className="bg-[#D0B264]/30 text-[#D0B264] text-xs">
                    <User className="h-2 w-2" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white truncate">
                    {bid.bidder.slice(0, 8)}...
                  </div>
                  <div className="text-xs text-gray-400">{bid.timestamp}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div
                  className={`text-xs font-mono font-semibold ${
                    bid.isWinning ? 'text-green-400' : 'text-white'
                  }`}
                >
                  {bid.amount.toFixed(1)}
                </div>
                {bid.isWinning && <div className="text-xs text-green-400">Win</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
