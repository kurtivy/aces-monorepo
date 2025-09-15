'use client';

import PlaceBidsInterface from './place-bids-interface';

export default function BiddingDemo() {
  return (
    <div className="max-w-md mx-auto">
      <PlaceBidsInterface
        listingId="test-listing-123"
        itemTitle="King Solomon's Baby"
        itemImage="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg"
        tokenAddress="0x7300...0219FE"
        retailPrice={47000}
        startingBidPrice={45000}
        isLive={true}
        isOwner={false}
        onBidPlaced={(bid) => {
          console.log('New bid placed:', bid);
        }}
      />
    </div>
  );
}
