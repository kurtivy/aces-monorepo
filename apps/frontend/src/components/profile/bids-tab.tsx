'use client';

import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

interface BidData {
  id: string;
  itemName: string;
  ticker: string;
  image: string;
  category: string;
  bidAmount: string;
  status: 'active' | 'outbid' | 'won' | 'expired';
  expiryDate: string;
  currentPrice: string;
}

interface BidsTabProps {
  bids?: BidData[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'text-[#D7BF75] bg-[#D7BF75]/10';
    case 'won':
      return 'text-[#184D37] bg-[#184D37]/10';
    case 'outbid':
      return 'text-red-400 bg-red-400/10';
    case 'expired':
      return 'text-[#928357] bg-[#928357]/10';
    default:
      return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
  }
};

const SAMPLE_BIDS: BidData[] = [
  {
    id: '1',
    itemName: '2009 McLaren MP4-24 F1 Car',
    ticker: '$MP424',
    image: '/placeholder.svg?height=40&width=40',
    category: 'Cars',
    bidAmount: '45.50 ETH',
    status: 'active',
    expiryDate: '2024-07-30',
    currentPrice: '66.85 ETH',
  },
  {
    id: '2',
    itemName: 'Richard Mille RM-88 Smiley',
    ticker: '$RM88',
    image: '/placeholder.svg?height=40&width=40',
    category: 'Watches',
    bidAmount: '8.25 ETH',
    status: 'outbid',
    expiryDate: '2024-07-25',
    currentPrice: '10.82 ETH',
  },
  {
    id: '3',
    itemName: 'Keith Haring "Untitled" (1989)',
    ticker: '$HARING',
    image: '/placeholder.svg?height=40&width=40',
    category: 'Art',
    bidAmount: '7.80 ETH',
    status: 'won',
    expiryDate: '2024-07-20',
    currentPrice: '8.57 ETH',
  },
  {
    id: '4',
    itemName: 'Nike SB Dunks "Freddy Krueger"',
    ticker: '$FDUNK',
    image: '/placeholder.svg?height=40&width=40',
    category: 'Sneakers',
    bidAmount: '0.35 ETH',
    status: 'expired',
    expiryDate: '2024-07-15',
    currentPrice: '0.40 ETH',
  },
];

export function BidsTab({ bids = SAMPLE_BIDS }: BidsTabProps) {
  return (
    <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-bold text-[#D0B284] mb-6 font-libre-caslon">Your Bids</h2>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 pb-4 border-b border-[#D0B284]/20 mb-4">
          <div className="col-span-4 text-[#DCDDCC] text-sm font-jetbrains uppercase">Item</div>
          <div className="col-span-2 text-center text-[#DCDDCC] text-sm font-jetbrains uppercase">
            Your Bid
          </div>
          <div className="col-span-2 text-center text-[#DCDDCC] text-sm font-jetbrains uppercase">
            Current Price
          </div>
          <div className="col-span-2 text-center text-[#DCDDCC] text-sm font-jetbrains uppercase">
            Status
          </div>
          <div className="col-span-2 text-right text-[#DCDDCC] text-sm font-jetbrains uppercase">
            Expires
          </div>
        </div>

        {/* Bid Rows */}
        <div className="space-y-4">
          {bids.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#DCDDCC] font-jetbrains">No bids found</p>
            </div>
          ) : (
            bids.map((bid) => (
              <div
                key={bid.id}
                className="grid grid-cols-12 gap-4 items-center py-3 hover:bg-[#D0B284]/5 transition-colors duration-200 rounded-lg"
              >
                {/* Item Info */}
                <div className="col-span-4 flex items-center space-x-4">
                  <Image
                    src={bid.image || '/placeholder.svg'}
                    alt={bid.itemName}
                    className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                    width={40}
                    height={40}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-white font-medium truncate">
                        {bid.itemName.split(' ').slice(0, 3).join(' ')}
                      </h3>
                      <span className="text-[#DCDDCC] font-jetbrains text-sm">{bid.ticker}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-[#D0B284]/10 text-[#D0B284] text-xs px-2 py-0.5"
                    >
                      {bid.category}
                    </Badge>
                  </div>
                </div>

                {/* Your Bid */}
                <div className="col-span-2 text-center">
                  <span className="text-[#D0B284] font-medium">{bid.bidAmount}</span>
                </div>

                {/* Current Price */}
                <div className="col-span-2 text-center">
                  <span className="text-white font-medium">{bid.currentPrice}</span>
                </div>

                {/* Status */}
                <div className="col-span-2 text-center">
                  <Badge className={`${getStatusColor(bid.status)} border-none font-medium`}>
                    {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                  </Badge>
                </div>

                {/* Expires */}
                <div className="col-span-2 text-right">
                  <span className="text-[#DCDDCC] text-sm">{bid.expiryDate}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
