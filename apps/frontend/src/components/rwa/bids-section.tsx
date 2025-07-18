'use client';

import { Gavel, TrendingUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <div className="h-full flex flex-col space-y-3 bg-black text-white rounded-xl">
      {/* Compact Header */}
      <div className="flex items-center justify-center mb-2">
        <h3 className="text-sm font-bold text-[#D0B264] tracking-widest uppercase">Bids</h3>
      </div>

      {/* Compact Current Bid Info */}
      <div className="bg-[#231F20] rounded-md border border-[#D0B264]/60 items-center justify-center flex flex-col mx-3">
        <div className="text-xs text-gray-300 mb-1 tracking-widest uppercase">Top Bid</div>
        <div className="text-lg font-bold text-white font-mono mb-1">
          {currentHighestBid.toFixed(2)} ETH
        </div>
        <div className="text-xs text-gray-400">≈ ${(currentHighestBid * 2400).toFixed(0)}</div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 mx-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              className="w-full bg-transparent hover:bg-[#D0B264]/10 text-[#D0B264] border border-[#D0B264]/60 font-semibold py-2 text-xs transition-all duration-200"
              size="sm"
            >
              View Bids
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#231F20] border-[#D0B264] text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#D0B264]">Bid History</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[300px] w-full">
              <div className="space-y-2 pr-4">
                {bids.map((bid) => (
                  <div
                    key={bid.id}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      bid.isWinning
                        ? 'bg-green-500/20 border-green-500/40'
                        : 'bg-[#928357]/20 border-[#D0B264]/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-[#D0B264]/30 text-[#D0B264] text-xs">
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{bid.bidder}</div>
                        <div className="text-xs text-gray-400">{bid.timestamp}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-mono font-semibold ${bid.isWinning ? 'text-green-400' : 'text-white'}`}
                      >
                        {bid.amount.toFixed(2)} ETH
                      </div>
                      <div className="text-xs text-gray-400">
                        ≈ ${(bid.amount * 2400).toFixed(0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex flex-col space-y-2 mt-4">
              <Button
                onClick={() => console.log('Navigate to bid submission page')}
                className="w-full bg-[#D0B264] hover:bg-[#D0B264]/90 text-black font-semibold"
              >
                Submit Bid
              </Button>
              <Button
                onClick={() => console.log('Navigate to buy now page')}
                className="w-full bg-[#184D37] hover:bg-[#184D37]/90 text-white font-semibold"
              >
                Buy Now
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex flex-col space-y-2">
          <Button
            onClick={() => console.log('Navigate to bid submission page')}
            className="w-full bg-[#928357] hover:bg-[#928357]/90 text-white border border-[#D0B264]/30 font-semibold py-2 text-xs transition-all duration-200"
            size="sm"
          >
            <Gavel className="h-3 w-3 mr-1" />
            Submit Bid
          </Button>
          <Button
            onClick={() => console.log('Navigate to buy now page')}
            className="w-full bg-[#184D37] hover:bg-[#184D37]/90 text-white font-semibold py-2 text-xs transition-all duration-200"
            size="sm"
          >
            Buy Now
          </Button>
        </div>
      </div>
    </div>
  );
}
