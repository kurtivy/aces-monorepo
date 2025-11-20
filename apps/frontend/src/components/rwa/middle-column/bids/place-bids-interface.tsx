'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Copy, AlertCircle, CheckCircle, Eye, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/auth-context';
import { BidsApi, type Bid } from '@/lib/api/bids';

interface PlaceBidsInterfaceProps {
  listingId: string;
  itemTitle: string;
  itemImage: string;
  tokenAddress: string;
  retailPrice: number;
  startingBidPrice?: number;
  isLive: boolean;
  isOwner: boolean;
  onBidPlaced?: (bid: Bid) => void;
  variant?: 'default' | 'mobile';
}

export default function PlaceBidsInterface({
  listingId,
  itemTitle,
  itemImage,
  tokenAddress,
  retailPrice,
  startingBidPrice,
  isLive,
  isOwner,
  onBidPlaced,
  variant = 'default',
}: PlaceBidsInterfaceProps) {
  const { user, getAccessToken } = useAuth();
  const [offerAmount, setOfferAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<{ isEligible: boolean; message: string } | null>(
    null,
  );
  const [highestBid, setHighestBid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAllBids, setShowAllBids] = useState(false);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);

  // Check user eligibility when component mounts or user changes
  useEffect(() => {
    const checkEligibility = async () => {
      if (!user) {
        setEligibility({ isEligible: false, message: 'Please connect your wallet to place bids' });
        return;
      }

      try {
        const token = await getAccessToken();
        if (!token) {
          setEligibility({ isEligible: false, message: 'Unable to authenticate' });
          return;
        }

        const result = await BidsApi.checkBiddingEligibility(token);
        if (result.success && result.data) {
          setEligibility(result.data);
        } else {
          setEligibility({ isEligible: false, message: 'Unable to verify eligibility' });
        }
      } catch (err) {
        setEligibility({ isEligible: false, message: 'Error checking eligibility' });
      }
    };

    checkEligibility();
  }, [user, getAccessToken]);

  // Load highest bid and all bids when component mounts
  useEffect(() => {
    const loadBidData = async () => {
      try {
        // Load highest bid
        const highestResult = await BidsApi.getHighestBid(listingId);
        if (highestResult.success && highestResult.data) {
          setHighestBid(parseFloat(highestResult.data.amount));
        }

        // Load all bids if showing all bids
        if (showAllBids) {
          const allBidsResult = await BidsApi.getListingBids(listingId, { limit: 50 });
          if (allBidsResult.success && allBidsResult.data) {
            setAllBids((allBidsResult.data as any) || []);
          } else {
            setAllBids([]);
          }
        }
      } catch (err) {
        console.error('Error loading bid data:', err);
      }
    };

    loadBidData();
  }, [listingId, showAllBids]);

  // Auto-refresh bid data every 30 seconds (silent refresh)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Silently refresh highest bid
        const highestResult = await BidsApi.getHighestBid(listingId);
        if (highestResult.success && highestResult.data) {
          const newHighestBid = parseFloat(highestResult.data.amount);
          if (newHighestBid !== highestBid) {
            setHighestBid(newHighestBid);
          }
        }

        // Silently refresh all bids if showing
        if (showAllBids) {
          const allBidsResult = await BidsApi.getListingBids(listingId, { limit: 50 });
          if (allBidsResult.success && allBidsResult.data) {
            setAllBids((allBidsResult.data as any) || []);
          } else {
            setAllBids([]);
          }
        }
      } catch (err) {
        // Silent fail for auto-refresh
        console.error('Auto-refresh error:', err);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [listingId, showAllBids, highestBid]);

  // Function to load all bids when "View All Bids" is clicked
  const loadAllBids = async () => {
    setBidsLoading(true);
    try {
      const result = await BidsApi.getListingBids(listingId, { limit: 50 });

      if (result.success && result.data) {
        setAllBids((result.data as any) || []);
        setShowAllBids(true);
      } else {
        setAllBids([]);
        setShowAllBids(true);
      }
    } catch (err) {
      console.error('❌ Error loading all bids:', err);
      setAllBids([]);
      setShowAllBids(true);
    } finally {
      setBidsLoading(false);
    }
  };

  const handleTopOfferClick = () => {
    if (highestBid) {
      setOfferAmount(highestBid.toString());
    }
  };

  const handleSubmit = async () => {
    if (!user || !eligibility?.isEligible) {
      setError('You must be verified to place bids');
      return;
    }

    if (isOwner) {
      setError('You cannot bid on your own listing');
      return;
    }

    if (!isLive) {
      setError('This listing is not currently live for bidding');
      return;
    }

    const amount = Number.parseFloat(offerAmount);
    if (amount <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    // Check minimum bid requirements
    const minBid = startingBidPrice || 0;
    if (amount < minBid) {
      setError(`Minimum bid is $${minBid.toLocaleString()}`);
      return;
    }

    // Check 1% increment requirement if there's a current highest bid
    if (highestBid && amount <= highestBid) {
      const minIncrement = highestBid * 0.01; // 1% of current highest bid
      const requiredBid = highestBid + minIncrement;
      setError(
        `Bid must be at least 1% higher than current highest bid ($${requiredBid.toLocaleString()})`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Unable to authenticate');
        return;
      }

      const result = await BidsApi.createBid(
        {
          listingId,
          amount: amount.toString(),
          message: message.trim() || undefined,
        },
        token,
      );

      if (result.success) {
        setSuccess('Bid placed successfully!');
        setOfferAmount('');
        setMessage('');
        setHighestBid(amount); // Update local highest bid

        // Refresh all bids if showing
        if (showAllBids) {
          const allBidsResult = await BidsApi.getListingBids(listingId, { limit: 50 });
          if (allBidsResult.success && allBidsResult.data) {
            setAllBids((allBidsResult.data as any) || []);
          } else {
            setAllBids([]);
          }
        }

        if (onBidPlaced && result.data) {
          onBidPlaced(result.data);
        }
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Failed to place bid');
      }
    } catch (err) {
      setError('Failed to place bid. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const calculateFloorDifference = () => {
    const amount = Number.parseFloat(offerAmount) || 0;
    const currentBid = highestBid || 0;
    const difference = amount - currentBid;
    return difference > 0
      ? `+$${difference.toLocaleString()}`
      : `-$${Math.abs(difference).toLocaleString()}`;
  };

  const isMobileVariant = variant === 'mobile';
  const primaryPriceValue = startingBidPrice ?? retailPrice;
  const formattedPrimaryPrice = primaryPriceValue
    ? `$${primaryPriceValue.toLocaleString()}`
    : 'Not set';

  return (
    <div className="bg-[#151c16]  rounded-lg">
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Item Details Section */}
          <div className="space-y-4">
            {/* Item Details with Price on Same Line */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-[#D0B284]/20 bg-[#151c16]/60">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[#D0B284]/20">
                  <Image
                    src={itemImage || '/placeholder.svg'}
                    alt={itemTitle}
                    width={64}
                    height={64}
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white font-proxima-nova">{itemTitle}</h3>
                  {isMobileVariant && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] uppercase tracking-wide text-[#8F9B8F]">
                        Starting from
                      </span>
                      <span className="text-sm font-semibold text-[#D0B284]">
                        {formattedPrimaryPrice}
                      </span>
                    </div>
                  )}
                  {!isMobileVariant && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#DCDDCC] font-jetbrains-mono">
                        {tokenAddress}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-[#D0B284]/10"
                        onClick={() => copyToClipboard(tokenAddress)}
                      >
                        <Copy className="h-3 w-3 text-[#D0B284]" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {!isMobileVariant && (
                <div className="text-right">
                  <div className="text-sm font-medium text-white font-proxima-nova">
                    {formattedPrimaryPrice}
                  </div>
                  <div className="text-xs text-[#DCDDCC]">Retail Price</div>
                </div>
              )}
            </div>

            {/* Price Details */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg border border-[#D0B284]/20 bg-[#151c16]/60">
                <span className="text-sm text-[#DCDDCC] font-proxima-nova">
                  Current Highest Bid
                </span>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {highestBid ? `$${highestBid.toLocaleString()}` : 'No bids have been made yet'}
                  </div>
                  <div className="text-xs text-[#DCDDCC] font-proxima-nova">
                    {highestBid ? 'Current Best' : 'Be the first to bid'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          {eligibility && (
            <div
              className={`p-3 rounded-lg border ${
                eligibility.isEligible
                  ? 'border-green-500/20 bg-green-500/10'
                  : 'border-red-500/20 bg-red-500/10'
              }`}
            >
              <div className="flex items-center gap-2">
                {eligibility.isEligible ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                )}
                <span
                  className={`text-sm ${
                    eligibility.isEligible ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {eligibility.message}
                </span>
              </div>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/10">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-400">{success}</span>
              </div>
            </div>
          )}

          {/* Make Offer Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white font-neue-world">MAKE OFFER</h2>

            {/* Offer Amount Input - Single Row */}
            <div className="p-4 rounded-lg border border-[#D0B284]/20 bg-[#151c16]/60">
              <div className={`gap-3 ${isMobileVariant ? 'flex flex-col' : 'flex items-center'}`}>
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm text-[#DCDDCC] whitespace-nowrap font-proxima-nova">
                    Your Offer
                  </span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="flex-1 h-10 text-sm bg-[#151c16] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC]"
                  />
                  <span className="text-sm text-[#DCDDCC] whitespace-nowrap font-proxima-nova">
                    USD
                  </span>
                </div>
                <Button
                  variant={isMobileVariant ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={handleTopOfferClick}
                  disabled={!highestBid}
                  className={`${
                    isMobileVariant
                      ? 'w-full border border-[#D0B284]/20 text-[#D0B284] hover:bg-[#D0B284]/10 disabled:opacity-50 disabled:cursor-not-allowed'
                      : 'border border-[#D0B284]/80 text-[#D0B284] hover:text-[#D0B284] hover:bg-[#D0B284]/30 text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {highestBid ? 'Match Top Offer' : 'No Bids Yet'}
                </Button>
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 rounded-lg border border-[#D0B284]/20 bg-[#151c16]/60">
              <div className="space-y-2">
                <span className="text-sm text-[#DCDDCC]">Message (Optional)</span>
                <Input
                  type="text"
                  placeholder="Add a message with your bid..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="h-10 text-sm bg-[#151c16] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC]"
                />
              </div>
            </div>

            {/* Summary Section */}
            <div className="space-y-3 border-t border-[#D0B284]/20 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC] font-proxima-nova">Total offer value:</span>
                <span className="text-white">
                  ${offerAmount ? Number.parseFloat(offerAmount).toLocaleString() : '0.00'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC] font-proxima-nova">Bid difference:</span>
                <span className="text-white">{offerAmount ? calculateFloorDifference() : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC] font-proxima-nova">Platform fees:</span>
                <span className="text-white">$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC] font-proxima-nova">Total est. proceeds:</span>
                <span className="text-white">
                  ${offerAmount ? Number.parseFloat(offerAmount).toLocaleString() : '0.00'}
                </span>
              </div>
            </div>

            {/* Submit Section */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#DCDDCC] font-proxima-nova">Bid expires in:</span>
                <span className="text-sm text-white">30 days</span>
              </div>
              <div
                className={`py-6 ${isMobileVariant ? 'flex justify-center' : 'flex justify-end'}`}
              >
                <Button
                  onClick={handleSubmit}
                  disabled={
                    !offerAmount ||
                    Number.parseFloat(offerAmount) <= 0 ||
                    !eligibility?.isEligible ||
                    isOwner ||
                    !isLive ||
                    loading
                  }
                  className={`bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#151c16] font-bold disabled:opacity-50 ${
                    isMobileVariant ? 'w-full max-w-xs py-4 text-base rounded-xl' : 'w-32'
                  }`}
                >
                  {loading ? 'Placing...' : 'Place Bid'}
                </Button>
              </div>
            </div>
          </div>

          {/* View All Bids Section */}
          <div className="space-y-4 pt-6 border-t border-[#D0B284]/20">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white font-neue-world">All Bids</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={showAllBids ? () => setShowAllBids(false) : loadAllBids}
                disabled={bidsLoading}
                className="border border-[#D0B284]/20 text-[#D0B284] hover:bg-[#D0B284]/10"
              >
                {bidsLoading ? (
                  'Loading...'
                ) : showAllBids ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide Bids
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    View All Bids
                  </>
                )}
              </Button>
            </div>

            {/* Bids Table */}
            {showAllBids && (
              <div className="space-y-3">
                {bidsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D0B284]"></div>
                    <span className="ml-2 text-sm text-[#DCDDCC] font-proxima-nova">
                      Loading bids...
                    </span>
                  </div>
                ) : allBids && Array.isArray(allBids) && allBids.length > 0 ? (
                  <div className="space-y-2">
                    {allBids.map((bid) => {
                      const wallet = bid.bidder?.walletAddress || '';
                      const username = bid.bidder?.username || '';
                      const isWalletLike = username.toLowerCase().startsWith('0x');
                      const shortenedUsername = isWalletLike
                        ? `${username.slice(0, 7)}…`
                        : username;
                      const condensedWallet = wallet ? `${wallet.slice(0, 7)}…` : null;
                      const displayName = shortenedUsername || condensedWallet || 'Anonymous';
                      const bidAmount = bid.amount ? Number.parseFloat(bid.amount) : 0;
                      const status = (bid.status || 'Pending').toUpperCase();
                      const statusStyles: Record<string, string> = {
                        ACCEPTED: 'bg-[#184D37]/15 text-[#37d488] border-[#184D37]/30',
                        REJECTED: 'bg-[#3b1d1d]/20 text-[#f87171] border-[#f87171]/30',
                        PENDING: 'bg-[#373017]/20 text-[#facc15] border-[#facc15]/30',
                      };
                      const statusStyle =
                        statusStyles[status as keyof typeof statusStyles] ||
                        'bg-[#2a2a2a]/30 text-[#DCDDCC] border-[#404040]/40';

                      return (
                        <div
                          key={bid.id}
                          className="grid grid-cols-[1.5fr_auto] md:grid-cols-[1.5fr_auto_auto] gap-3 rounded-xl border border-[#2a3b2a] bg-[#101910] px-3 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#D0B284]/15 flex items-center justify-center text-sm font-semibold text-[#D0B284]">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-white">{displayName}</span>
                              <span className="text-[11px] uppercase tracking-wide text-[#8F9B8F]">
                                {new Date(bid.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col text-right">
                            <span className="text-sm font-semibold text-white">
                              ${bidAmount.toLocaleString()}
                            </span>
                            <span
                              className={`mt-1 inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${statusStyle}`}
                            >
                              {status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-[#DCDDCC] text-sm">No bids have been made yet</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
