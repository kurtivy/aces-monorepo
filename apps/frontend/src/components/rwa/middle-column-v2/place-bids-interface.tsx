'use client';

import Image from 'next/image';
import { ChangeEvent, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth/auth-context';
import { BidsApi, type Bid } from '@/lib/api/bids';
import { createImageErrorHandler, getValidImageSrc } from '@/lib/utils/image-error-handler';

const NUMERIC_INPUT_PATTERN = /^\d*\.?\d*$/;

const formatOfferValue = (rawValue: string) => {
  const [integerPart, decimalPart] = rawValue.split('.');
  const formattedInteger = integerPart ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';

  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
};

const parseOfferAmountValue = (value: string) => {
  if (!value) {
    return Number.NaN;
  }

  const normalized = value.replace(/,/g, '');
  const parsed = Number.parseFloat(normalized);

  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

interface PlaceBidsInterfaceV2Props {
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
  onOpenTerms?: () => void;
}

export function PlaceBidsInterfaceV2(props: PlaceBidsInterfaceV2Props) {
  const {
    listingId,
    itemTitle,
    itemImage,
    startingBidPrice,
    isLive,
    isOwner,
    onBidPlaced,
    variant = 'default',
    onOpenTerms,
  } = props;

  const { user, getAccessToken, connectWallet } = useAuth();
  const [offerAmount, setOfferAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [highestBid, setHighestBid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const hasUserClearedInputRef = useRef(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);

      try {
        const highestResult = await BidsApi.getHighestBid(listingId);
        if (highestResult.success && highestResult.data) {
          setHighestBid(parseFloat(highestResult.data.amount));
        }
      } catch (err) {
        console.error('Error loading bid data:', err);
      }

      setInitialLoading(false);
    };

    loadInitialData();
  }, [listingId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const highestResult = await BidsApi.getHighestBid(listingId);
        if (highestResult.success && highestResult.data) {
          const newHighestBid = parseFloat(highestResult.data.amount);
          if (newHighestBid !== highestBid) {
            setHighestBid(newHighestBid);
          }
        }
      } catch (err) {
        console.error('Auto-refresh error:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [listingId, highestBid]);

  // Reset "user cleared" flag when listing changes (fresh state)
  useEffect(() => {
    hasUserClearedInputRef.current = false;
  }, [listingId]);

  // Set default offer amount to highest bid + $1000 (only on initial load, not when user clears)
  useEffect(() => {
    const highestBidValue = typeof highestBid === 'number' ? highestBid : null;
    const reservePrice = startingBidPrice ?? null;
    const fallbackHighestBid =
      highestBidValue == null && reservePrice != null
        ? Math.round((reservePrice * 0.75) / 100) * 100
        : null;
    const displayHighestBid = highestBidValue ?? fallbackHighestBid;

    // Only set default if offer amount is empty, user hasn't cleared it, and we have a highest bid
    if (!offerAmount && !hasUserClearedInputRef.current && displayHighestBid != null) {
      const defaultOffer = displayHighestBid + 1000;
      setOfferAmount(formatOfferValue(defaultOffer.toString()));
    }
  }, [highestBid, startingBidPrice, offerAmount]);

  const handleOfferInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value.replace(/,/g, '');

    if (inputValue === '') {
      hasUserClearedInputRef.current = true;
      setOfferAmount('');
      return;
    }

    if (!NUMERIC_INPUT_PATTERN.test(inputValue)) {
      return;
    }

    setOfferAmount(formatOfferValue(inputValue));
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('Connect your wallet to place a bid');
      return;
    }

    if (isOwner) {
      setError('You cannot bid on your own listing');
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the terms and conditions before placing a bid');
      return;
    }

    if (!isLive) {
      setError('This listing is not currently live for bidding');
      return;
    }

    const amount = parseOfferAmountValue(offerAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    const minBid = startingBidPrice || 0;
    if (amount < minBid) {
      setError(`Minimum bid is $${minBid.toLocaleString()}`);
      return;
    }

    if (highestBid && amount <= highestBid) {
      const minIncrement = highestBid * 0.01;
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
        setError('Connect your wallet to place a bid');
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
        hasUserClearedInputRef.current = false;
        setOfferAmount('');
        setMessage('');
        setHighestBid(amount);

        if (onBidPlaced && result.data) {
          onBidPlaced(result.data);
        }
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Failed to place bid');
      }
    } catch {
      setError('Failed to place bid. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isMobileVariant = variant === 'mobile';
  const trimmedItemImage = itemImage?.trim();
  const hasImage = Boolean(trimmedItemImage);
  const imageAlt = itemTitle ? `${itemTitle} preview` : 'Asset preview';
  const offerInputId = `offer-amount-${listingId}`;
  const messageInputId = `offer-message-${listingId}`;
  const isNotConnected = !user;
  const numericOfferAmount = parseOfferAmountValue(offerAmount);
  const termsCheckboxId = `accept-terms-${listingId}`;
  const reservePrice = startingBidPrice ?? null;
  const reserveStatusMessage =
    reservePrice != null
      ? (highestBid ?? 0) >= reservePrice
        ? 'Reserve price met'
        : 'Reserve price not met'
      : highestBid
        ? 'Current highest bid'
        : 'Be the first to bid';

  const handleTermsLinkClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenTerms?.();
  };

  const highestBidValue = typeof highestBid === 'number' ? highestBid : null;
  const fallbackHighestBid =
    highestBidValue == null && reservePrice != null
      ? Math.round((reservePrice * 0.75) / 100) * 100
      : null;
  const displayHighestBid = highestBidValue ?? fallbackHighestBid;

  const canSubmitBid =
    Boolean(offerAmount) &&
    !Number.isNaN(numericOfferAmount) &&
    numericOfferAmount > 0 &&
    Boolean(user) &&
    !isOwner &&
    isLive &&
    !loading &&
    termsAccepted;

  return (
    <div className="h-full border-t border-[#D0B284]/15 bg-[#151c16] overflow-hidden">
      <div className="relative h-56 sm:h-64 md:h-72 border-b border-[#D0B284]/20 bg-[#151c16]/60">
        {hasImage ? (
          <Image
            src={getValidImageSrc(trimmedItemImage!, undefined, {
              width: 800,
              height: 600,
              text: 'Image error',
            })}
            alt={imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 40vw"
            unoptimized={trimmedItemImage!.includes('storage.googleapis.com')}
            onError={createImageErrorHandler({
              fallbackText: 'Image',
              width: 800,
              height: 600,
            })}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#8F9B8F] text-sm font-proxima-nova">
            No images available
          </div>
        )}
      </div>
      {initialLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#D0B284]" />
            <span className="text-sm text-[#D0B284]/80 font-proxima-nova">
              Loading bid information...
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          <div className="flex flex-col">
            <div>
              <h2 className="text-lg font-semibold text-white font-neue-world">
                {isNotConnected ? 'CURRENT BID' : 'MAKE OFFER'}
              </h2>
            </div>
            <div className="text-left">
              <div className="text-xs font-medium text-[#D0B284] font-proxima-nova">
                {displayHighestBid != null ? (
                  <>
                    Highest Bid:{' '}
                    <span className="text-white text-sm">
                      ${displayHighestBid.toLocaleString()}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div className="text-xs text-[#D0B284]/80 font-proxima-nova italic mt-3">
                {reserveStatusMessage}
              </div>
            </div>

            {isNotConnected && (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-[#D0B284]/30 bg-[#D0B284]/10 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-[#D0B284]" />
                  <span className="text-sm text-[#D0B284]">
                    Connect your wallet to place a bid.
                  </span>
                </div>
                <Button
                  type="button"
                  onClick={() => connectWallet()}
                  className="bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#151c16] font-semibold"
                >
                  Connect wallet
                </Button>
              </div>
            )}

            {!isNotConnected && (
              <>
                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span className="text-sm text-red-400">{error}</span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-sm text-green-400">{success}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div
                    className={`gap-3 ${isMobileVariant ? 'flex flex-col' : 'flex items-center'}`}
                  >
                    <div className="w-full">
                      <label htmlFor={offerInputId} className="sr-only">
                        Your Offer
                      </label>
                      <div className="flex flex-col rounded-xl border border-[#D0B284]/40 bg-[#101910] px-4 py-3">
                        <span className="text-xs uppercase tracking-wide text-[#D0B284] font-proxima-nova">
                          Your Offer
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-base text-[#DCDDCC] font-proxima-nova">$</span>
                          <Input
                            id={offerInputId}
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={offerAmount}
                            onChange={handleOfferInputChange}
                            className="flex-1 border-0 bg-transparent p-0 text-lg font-semibold text-white placeholder:text-[#727B72] h-auto leading-tight focus-visible:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:border-transparent focus-visible:text-white"
                          />
                          <span className="text-xs text-[#DCDDCC] font-proxima-nova">USD</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full">
                    <label htmlFor={messageInputId} className="sr-only">
                      Message (Optional)
                    </label>
                    <div className="flex flex-col rounded-xl border border-[#D0B284]/40 bg-[#101910] px-4 py-3">
                      <span className="text-xs uppercase tracking-wide text-[#D0B284] font-proxima-nova">
                        Message (Optional)
                      </span>
                      <Textarea
                        id={messageInputId}
                        rows={3}
                        placeholder="Add a message with your bid..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="mt-2 min-h-[72px] max-h-32 resize-none border-0 bg-transparent p-0 text-sm text-white placeholder:text-[#727B72] leading-tight overflow-y-auto focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="py-2 flex w-full">
                    <Button
                      onClick={handleSubmit}
                      disabled={!canSubmitBid}
                      className={`bg-black text-2xl border border-[#D0B284]/80 hover:bg-[#D0B284]/10 text-[#D0B284] font-spray-letters disabled:opacity-50 disabled:pointer-events-none ${
                        isMobileVariant ? 'w-full py-4 text-base rounded-xl' : 'w-full'
                      }`}
                    >
                      {loading ? 'Placing...' : 'Place Bid'}
                    </Button>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={termsCheckboxId}
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-1 border-[#D0B284]/40 data-[state=checked]:bg-[#D0B284] data-[state=checked]:text-[#151c16]"
                  />
                  <label
                    htmlFor={termsCheckboxId}
                    className="text-xs text-[#DCDDCC] font-proxima-nova leading-relaxed cursor-pointer"
                  >
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={handleTermsLinkClick}
                      className="text-[#D0B284] underline underline-offset-2 hover:text-[#f3d8a5]"
                    >
                      Terms & Conditions
                    </button>
                    .
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
