'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { useTokenLaunch } from '../context';

export function ManageListingsCard() {
  const { effectiveWalletAddress, createdListings, handleToggleListingLive } = useTokenLaunch();

  if (!effectiveWalletAddress || createdListings.length === 0) return null;

  return (
    <Card className="bg-black border-yellow-400/20">
      <CardHeader>
        <CardTitle className="text-white font-libre-caslon flex items-center">
          <ToggleRight className="w-5 h-5 mr-2 text-yellow-400" />
          Manage Listings (Toggle Live Status)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-yellow-500/10 border border-yellow-400/20 rounded-lg">
          <p className="text-sm text-yellow-300 mb-2">
            <strong>Step 4:</strong> Activate listings for trading
          </p>
          <p className="text-xs text-yellow-200/70">
            Once a listing is live, users can start trading the associated token on your platform.
          </p>
        </div>

        <div className="space-y-3">
          {createdListings.map((listing) => (
            <div
              key={listing.id}
              className="p-4 border border-yellow-400/20 rounded-lg flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-white">
                  {listing.title} ({listing.symbol})
                </h3>
                <p className="text-sm text-[#DCDDCC]">
                  Status: {listing.isLive ? 'Live' : 'Not Live'}
                </p>
                {listing.tokenId && (
                  <p className="text-xs text-[#DCDDCC] font-mono">
                    Token: {listing.tokenId.slice(0, 10)}...
                  </p>
                )}
              </div>
              <Button
                onClick={() => handleToggleListingLive(listing.id, listing.isLive)}
                variant={listing.isLive ? 'outline' : 'default'}
                className={
                  listing.isLive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }
              >
                {listing.isLive ? (
                  <>
                    <ToggleLeft className="w-4 h-4 mr-2" />
                    Set Not Live
                  </>
                ) : (
                  <>
                    <ToggleRight className="w-4 h-4 mr-2" />
                    Set Live
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
