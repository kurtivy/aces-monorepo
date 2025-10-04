'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Copy, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth/auth-context';
import { BidsApi, type Bid } from '@/lib/api/bids';

interface PlaceBidsInterfaceProps {
  listingId: string;
  itemTitle?: string;
  itemImage?: string;
  tokenAddress?: string;
  retailPrice?: number;
  startingBidPrice?: number;
  isLive?: boolean;
  isOwner?: boolean;
  onBidPlaced?: (bid: Bid) => void;
}

export default function PlaceBidsInterface({
  listingId,
  itemTitle = 'Asset Title',
  itemImage,
  tokenAddress = '0x7300...0219FE',
  retailPrice = 47000,
  startingBidPrice = 40000,
  isLive = true,
  isOwner = false,
  onBidPlaced,
}: PlaceBidsInterfaceProps) {
  const { getAccessToken, isAuthenticated } = useAuth();

  const [offerAmount, setOfferAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);
  const [isEligible, setIsEligible] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState('');
  const [highestBid, setHighestBid] = useState<Bid | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  // Check bidding eligibility on mount
  useEffect(() => {
    if (isAuthenticated && !isOwner) {
      checkBiddingEligibility();
    } else {
      setIsCheckingEligibility(false);
    }
  }, [isAuthenticated, isOwner]);

  // Load highest bid on mount
  useEffect(() => {
    loadHighestBid();
  }, [listingId]);

  const checkBiddingEligibility = async () => {
    try {
      const authToken = await getAccessToken();
      if (!authToken) return;

      const response = await BidsApi.checkBiddingEligibility(authToken);
      if (response.success && response.data) {
        setIsEligible(response.data.isEligible);
        setEligibilityMessage(response.data.message);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const loadHighestBid = async () => {
    try {
      const response = await BidsApi.getHighestBid(listingId);
      if (response.success && response.data !== undefined) {
        setHighestBid(response.data);
      }
    } catch (error) {
      console.error('Error loading highest bid:', error);
    }
  };

  const handleTopOfferClick = () => {
    if (highestBid) {
      const currentAmount = parseFloat(highestBid.amount);
      const newAmount = currentAmount + 100; // Add $100 minimum increment
      setOfferAmount(newAmount.toString());
    } else if (startingBidPrice) {
      setOfferAmount(startingBidPrice.toString());
    }
  };

  const validateBidAmount = (): string | null => {
    const amount = parseFloat(offerAmount);

    if (isNaN(amount) || amount <= 0) {
      return 'Please enter a valid bid amount';
    }

    if (startingBidPrice && amount < startingBidPrice) {
      return `Bid must be at least ${startingBidPrice.toLocaleString()}`;
    }

    if (highestBid) {
      const currentHighest = parseFloat(highestBid.amount);
      if (amount <= currentHighest) {
        return `Bid must be higher than current highest bid of ${currentHighest.toLocaleString()}`;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateBidAmount();
    if (validationError) {
      setSubmitStatus('error');
      setSubmitMessage(validationError);
      return;
    }

    setIsLoading(true);
    setSubmitStatus('idle');
    setSubmitMessage('');

    try {
      const authToken = await getAccessToken();
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const response = await BidsApi.createBid(
        {
          listingId,
          amount: offerAmount,
          message: bidMessage || undefined,
        },
        authToken,
      );

      if (response.success && response.data) {
        setSubmitStatus('success');
        setSubmitMessage('Bid placed successfully!');
        setOfferAmount('');
        setBidMessage('');

        // Update highest bid
        await loadHighestBid();

        // Call callback if provided
        if (onBidPlaced) {
          onBidPlaced(response.data);
        }
      } else {
        setSubmitStatus('error');
        setSubmitMessage(
          typeof response.error === 'string' ? response.error : 'Failed to place bid',
        );
      }
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage(error instanceof Error ? error.message : 'Failed to place bid');
    } finally {
      setIsLoading(false);
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
    const amount = parseFloat(offerAmount) || 0;
    const currentHighest = highestBid ? parseFloat(highestBid.amount) : startingBidPrice || 0;
    const difference = amount - currentHighest;
    return difference > 0
      ? `+${difference.toLocaleString()}`
      : `-${Math.abs(difference).toLocaleString()}`;
  };

  // Show loading state while checking eligibility
  if (isCheckingEligibility) {
    return (
      <div className="bg-black border border-[#D0B284]/20 rounded-lg p-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#D0B284]" />
          <span className="text-[#DCDDCC]">Checking bidding eligibility...</span>
        </div>
      </div>
    );
  }

  // Show not eligible message
  if (isAuthenticated && !isOwner && !isEligible) {
    return (
      <div className="bg-black border border-[#D0B284]/20 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          <span className="text-white font-medium">Verification Required</span>
        </div>
        <p className="text-[#DCDDCC] mb-4">{eligibilityMessage}</p>
        <Button
          onClick={() => (window.location.href = '/verify')}
          className="bg-[#D0B284] hover:bg-[#D0B284]/90 text-black"
        >
          Complete Verification
        </Button>
      </div>
    );
  }

  // Show owner message
  if (isOwner) {
    return (
      <div className="bg-black border border-[#D0B284]/20 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500" />
          <span className="text-white">You cannot bid on your own listing</span>
        </div>
      </div>
    );
  }

  // Show not live message
  if (!isLive) {
    return (
      <div className="bg-black border border-[#D0B284]/20 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          <span className="text-white">This listing is not accepting bids yet</span>
        </div>
      </div>
    );
  }

  // Show login prompt
  if (!isAuthenticated) {
    return (
      <div className="bg-black border border-[#D0B284]/20 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500" />
          <span className="text-white">Please connect your wallet to place bids</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black border border-[#D0B284]/20 rounded-lg">
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Status Message */}
          {submitStatus !== 'idle' && (
            <div
              className={`p-4 rounded-lg flex items-center gap-3 ${
                submitStatus === 'success'
                  ? 'bg-green-900/30 border border-green-500/50 text-green-300'
                  : 'bg-red-900/30 border border-red-500/50 text-red-300'
              }`}
            >
              {submitStatus === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <p>{submitMessage}</p>
            </div>
          )}

          {/* Item Details Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Item Details</h2>

            <div className="flex items-center justify-between p-3 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
              <div className="flex items-center gap-3">
                {itemImage && (
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[#D0B284]/20">
                    <Image
                      src={itemImage}
                      alt={itemTitle}
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-white">{itemTitle}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[#DCDDCC]">{tokenAddress}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-[#D0B284]/10"
                      onClick={() => copyToClipboard(tokenAddress)}
                    >
                      <Copy className="h-3 w-3 text-[#D0B284]" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">
                  ${retailPrice.toLocaleString()}
                </div>
                <div className="text-xs text-[#DCDDCC]">Retail Price</div>
              </div>
            </div>

            {/* Price Details */}
            <div className="space-y-3">
              {startingBidPrice && (
                <div className="flex justify-between items-center p-3 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
                  <span className="text-sm text-[#DCDDCC]">Starting Bid</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">
                      ${startingBidPrice.toLocaleString()}
                    </div>
                    <div className="text-xs text-[#DCDDCC]">Minimum</div>
                  </div>
                </div>
              )}

              {highestBid && (
                <div className="flex justify-between items-center p-3 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
                  <span className="text-sm text-[#DCDDCC]">Highest Bid</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">
                      ${parseFloat(highestBid.amount).toLocaleString()}
                    </div>
                    <div className="text-xs text-[#DCDDCC]">Current Best</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Make Offer Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">MAKE OFFER</h2>

            {/* Offer Amount Input */}
            <div className="p-4 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#DCDDCC] whitespace-nowrap">Your Offer</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="flex-1 h-10 text-sm bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC]"
                />
                <span className="text-sm text-[#DCDDCC] whitespace-nowrap">USD</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTopOfferClick}
                  className="border border-[#D0B284]/80 text-[#D0B284] hover:text-[#D0B284] hover:bg-[#D0B284]/30 text-xs whitespace-nowrap"
                >
                  {highestBid ? 'Beat Top Bid' : 'Set Starting Bid'}
                </Button>
              </div>
            </div>

            {/* Bid Message */}
            <div className="space-y-2">
              <label className="text-sm text-[#DCDDCC]">Message (optional)</label>
              <Textarea
                placeholder="Add a message with your bid..."
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                className="bg-[#231F20] border border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] min-h-[80px] resize-none"
              />
            </div>

            {/* Summary Section */}
            <div className="space-y-3 border-t border-[#D0B284]/20 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Total offer value:</span>
                <span className="text-white">
                  ${offerAmount ? parseFloat(offerAmount).toLocaleString() : '0.00'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Above current highest:</span>
                <span className="text-white">{offerAmount ? calculateFloorDifference() : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Platform fees:</span>
                <span className="text-white">$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Bid expires:</span>
                <span className="text-white">30 days</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!offerAmount || parseFloat(offerAmount) <= 0 || isLoading}
                className="w-32 bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] font-bold disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Placing...
                  </div>
                ) : (
                  'Place Bid'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
