'use client';

import { useState, useEffect } from 'react';
import { BidsApi } from '@/lib/api/bids';

interface HighestBidDisplayProps {
  listingId: string;
  /** Shown when there are no bids (e.g. starting/reserve price) */
  reservePrice?: number | null;
  className?: string;
}

export function HighestBidDisplay({
  listingId,
  reservePrice,
  className = '',
}: HighestBidDisplayProps) {
  const [highestBid, setHighestBid] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHighestBid = async () => {
      if (!listingId) return;

      setLoading(true);
      setError(null);

      try {
        const result = await BidsApi.getHighestBid(listingId);

        if (result.success && result.data) {
          const bidAmount = parseFloat(result.data.amount);
          setHighestBid(bidAmount);
        } else {
          setHighestBid(null);
        }
      } catch (err) {
        console.error('❌ Error fetching highest bid:', err);
        setError('Failed to load bid data');
        setHighestBid(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHighestBid();
  }, [listingId]);

  // Auto-refresh every 30 seconds to keep bid data current
  useEffect(() => {
    if (!listingId) return;

    const interval = setInterval(async () => {
      try {
        const result = await BidsApi.getHighestBid(listingId);
        if (result.success && result.data) {
          const bidAmount = parseFloat(result.data.amount);
          setHighestBid(bidAmount);
        }
      } catch (err) {
        // Silent fail for auto-refresh
        console.error('Auto-refresh error:', err);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [listingId]);

  const label = highestBid
    ? 'Current high bid'
    : reservePrice != null
      ? 'Reserve price'
      : 'Current high bid';
  const value =
    highestBid != null
      ? `$${highestBid.toLocaleString()}`
      : reservePrice != null
        ? `$${reservePrice.toLocaleString()}`
        : null;

  return (
    <div
      className={`bg-[#151c16] border border-[#D0B284]/20 rounded-lg overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between p-3">
        <span className="text-[#DCDDCC] text-xs font-medium">{label}:</span>
        <span className="text-white text-xs font-semibold">
          {loading ? (
            <div className="flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-[#D0B284]"></div>
              <span>Loading...</span>
            </div>
          ) : error ? (
            <span className="text-red-400">Error</span>
          ) : value ? (
            value
          ) : (
            <span className="text-[#DCDDCC]">No bids yet</span>
          )}
        </span>
      </div>
    </div>
  );
}
