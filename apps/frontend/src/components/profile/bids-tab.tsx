'use client';

// import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SellerDashboardOverlay } from './seller-dashboard-overlay';
// import Image from 'next/image';
// import { useEffect } from 'react';
import { useState } from 'react';
// import { useAuth } from '@/lib/auth/auth-context';
// import { BidsApi, BidData } from '@/lib/api/bids';

// interface DisplayBidData {
//   id: string;
//   itemName: string;
//   ticker: string;
//   image: string;
//   category: string;
//   bidAmount: string;
//   status: 'active' | 'outbid' | 'won' | 'expired';
//   expiryDate: string;
//   currentPrice: string;
// }

// const getStatusColor = (status: string) => {
//   switch (status) {
//     case 'active':
//       return 'text-[#D7BF75] bg-[#D7BF75]/10';
//     case 'won':
//       return 'text-[#184D37] bg-[#184D37]/10';
//     case 'outbid':
//       return 'text-red-400 bg-red-400/10';
//     case 'expired':
//       return 'text-[#928357] bg-[#928357]/10';
//     default:
//       return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
//   }
// };

// // Helper function to determine bid status based on listing state and bid data
// const getBidStatus = (bid: BidData): 'active' | 'outbid' | 'won' | 'expired' => {
//   if (!bid.listing?.isLive) {
//     return 'expired';
//   }

//   // For now, we'll consider all live bids as active
//   // In a real implementation, you'd compare with current highest bid
//   return 'active';
// };

// // Helper function to format bid data for display
// const formatBidForDisplay = (bid: BidData): DisplayBidData => {
//   const status = getBidStatus(bid);
//   const imageUrl = bid.listing?.imageGallery?.[0] || '/placeholder.svg?height=40&width=40';

//   return {
//     id: bid.id,
//     itemName: bid.listing?.title || 'Unknown Item',
//     ticker: bid.listing?.symbol || 'N/A',
//     image: imageUrl,
//     category: 'Asset', // You might want to add category to the listing model
//     bidAmount: `${bid.amount} ${bid.currency}`,
//     status,
//     expiryDate: bid.expiresAt ? new Date(bid.expiresAt).toLocaleDateString() : 'No expiry',
//     currentPrice: `${bid.amount} ${bid.currency}`, // For now, same as bid amount
//   };
// };

export function BidsTab() {
  // const { getAccessToken } = useAuth();
  // const [bids, setBids] = useState<DisplayBidData[]>([]);
  // const [isLoading, setIsLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);
  const [isSellerDashboardOpen, setIsSellerDashboardOpen] = useState(false);

  // useEffect(() => {
  //   const fetchBids = async () => {
  //     try {
  //       setIsLoading(true);
  //       setError(null);

  //       const token = await getAccessToken();
  //       if (!token) {
  //         setError('Authentication required');
  //         return;
  //       }

  //       const data = await BidsApi.getUserBids(token);

  //       if (Array.isArray(data)) {
  //         const formattedBids = data.map(formatBidForDisplay);
  //         setBids(formattedBids);
  //       } else {
  //         setError('Failed to fetch bids');
  //       }
  //     } catch (err) {
  //       setError(err instanceof Error ? err.message : 'An error occurred while fetching bids');
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };

  //   fetchBids();
  // }, [getAccessToken]);

  // const renderContent = () => {
  //   if (isLoading) {
  //     return (
  //       <div className="animate-pulse space-y-4">
  //         {[...Array(3)].map((_, i) => (
  //           <div key={i} className="h-16 bg-[#D0B284]/10 rounded-lg" />
  //         ))}
  //       </div>
  //     );
  //   }

  //   if (error) {
  //     return (
  //       <div className="text-center py-8">
  //         <p className="text-red-400 font-jetbrains">{error}</p>
  //       </div>
  //     );
  //   }

  //   return (
  //     <>
  //       {/* Table Header */}
  //       <div className="grid grid-cols-12 gap-4 pb-4 border-b border-dashed border-[#E6E3D3]/25 mb-4">
  //         <div className="col-span-4 text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
  //           Item
  //         </div>
  //         <div className="col-span-2 text-center text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
  //           Your Bid
  //         </div>
  //         <div className="col-span-2 text-center text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
  //           Current Price
  //         </div>
  //         <div className="col-span-2 text-center text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
  //           Status
  //         </div>
  //         <div className="col-span-2 text-right text-[#D7BF75] text-sm font-medium uppercase tracking-wide">
  //           Expires
  //         </div>
  //       </div>

  //       {/* Bid Rows */}
  //       <div className="space-y-4">
  //         {bids.length === 0 ? (
  //           <div className="text-center py-8">
  //             <p className="text-[#E6E3D3] font-jetbrains">No bids found</p>
  //           </div>
  //         ) : (
  //           bids.map((bid) => (
  //             <div
  //               key={bid.id}
  //               className="grid grid-cols-12 gap-4 items-center py-3 border-b border-dashed border-[#E6E3D3]/10 last:border-b-0"
  //             >
  //               {/* Item Info */}
  //               <div className="col-span-4 flex items-center space-x-4">
  //                 <Image
  //                   src={bid.image || '/placeholder.svg'}
  //                   alt={bid.itemName}
  //                   className="w-10 h-10 rounded object-cover border border-[#D0B284]/20"
  //                   width={40}
  //                   height={40}
  //                 />
  //                 <div className="flex-1 min-w-0">
  //                   <div className="flex items-center space-x-2 mb-1">
  //                     <h3 className="text-[#E6E3D3] font-medium truncate text-sm">
  //                       {bid.itemName.split(' ').slice(0, 3).join(' ')}
  //                     </h3>
  //                     <span className="text-[#E6E3D3] font-mono text-sm">{bid.ticker}</span>
  //                   </div>
  //                 </div>
  //               </div>

  //               {/* Your Bid */}
  //               <div className="col-span-2 text-center">
  //                 <span className="text-[#E6E3D3] text-sm">{bid.bidAmount}</span>
  //               </div>

  //               {/* Current Price */}
  //               <div className="col-span-2 text-center">
  //                 <span className="text-[#E6E3D3] text-sm">{bid.currentPrice}</span>
  //               </div>

  //               {/* Status */}
  //               <div className="col-span-2 text-center">
  //                 <Badge className={`${getStatusColor(bid.status)} border-none text-xs`}>
  //                   {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
  //                 </Badge>
  //               </div>

  //               {/* Expires */}
  //               <div className="col-span-2 text-right">
  //                 <span className="text-[#E6E3D3] text-sm">{bid.expiryDate}</span>
  //               </div>
  //             </div>
  //           ))
  //         )}
  //       </div>
  //     </>
  //   );
  // };

  return (
    <div className="relative">
      {/* Seller Dashboard Overlay - full screen overlay */}
      <SellerDashboardOverlay
        isOpen={isSellerDashboardOpen}
        onClose={() => setIsSellerDashboardOpen(false)}
      />

      {/* Main Table */}
      <div className="bg-[#0f1511] rounded-lg border border-dashed border-[#E6E3D3]/25">
        {/* Corner ticks */}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

          {/* Table Content */}
          <div className="p-6">
            {/* Tab selectors and Seller Dashboard button - aligned on same line */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex-1">
                <TabsList className="bg-transparent border-none p-0 h-auto space-x-8">
                  <TabsTrigger
                    value="tokens"
                    className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                  >
                    TOKENS
                  </TabsTrigger>
                  <TabsTrigger
                    value="bids"
                    className="bg-transparent text-[#DCDDCC] text-lg font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                  >
                    BIDS
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Seller Dashboard Button - aligned with tabs */}
              <Button
                onClick={() => setIsSellerDashboardOpen(true)}
                className="bg-[#C9AE6A] hover:bg-[#C9AE6A]/80 text-black font-medium text-sm px-4 py-2"
              >
                SELLER DASHBOARD
              </Button>
            </div>

            {/* Coming Soon Content */}
            <div className="text-center py-16">
              <div className="space-y-4">
                <h2 className="text-[#D7BF75] text-2xl font-semibold uppercase tracking-wide">
                  Coming Soon
                </h2>
              </div>
            </div>
            {/* {renderContent()} */}
          </div>
        </div>
      </div>
    </div>
  );
}
