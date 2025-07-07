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
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Current Bids</h3>
        <div className="flex items-center gap-1 text-green-400">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-medium">{totalBids} bids</span>
        </div>
      </div>

      {/* Current Bid Info */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-sm text-gray-400 mb-1">Highest Bid</div>
        <div className="text-2xl font-bold text-white font-mono mb-1">
          {currentHighestBid.toFixed(2)} ETH
        </div>
        <div className="text-xs text-gray-400">≈ ${(currentHighestBid * 2400).toFixed(2)} USD</div>
      </div>

      {/* Place Bid Button */}
      <Button
        onClick={handleGoToBidding}
        className="w-full bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-semibold py-3 transition-all duration-200"
      >
        <Gavel className="h-4 w-4 mr-2" />
        Place Bid
      </Button>

      {/* Recent Bids */}
      <div className="flex-1 flex flex-col">
        <h4 className="text-sm font-semibold text-[#D0B264] mb-3">Recent Bids</h4>
        <div className="space-y-2 flex-1 overflow-y-auto max-h-64">
          {bids.map((bid) => (
            <div
              key={bid.id}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors border ${
                bid.isWinning
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-[#D0B264]/20 text-[#D0B264] text-xs">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-xs font-medium text-white">{bid.bidder}</div>
                  <div className="text-xs text-gray-400">{bid.timestamp}</div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-xs font-mono font-semibold ${bid.isWinning ? 'text-green-400' : 'text-white'}`}
                >
                  {bid.amount.toFixed(2)} ETH
                </div>
                {bid.isWinning && <div className="text-xs text-green-400">Winning</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
