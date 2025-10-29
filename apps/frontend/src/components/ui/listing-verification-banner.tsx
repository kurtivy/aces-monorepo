'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export function ListingVerificationBanner() {
  const { isAuthenticated, isVerifiedSeller, user } = useAuth();
  const sellerStatus = user?.sellerStatus;

  // Determine visual variant
  const variant = !isAuthenticated
    ? 'connect'
    : isVerifiedSeller
      ? sellerStatus === 'PENDING'
        ? 'pending'
        : 'approved'
      : 'required';

  const containerClasses =
    variant === 'pending'
      ? 'from-yellow-500/15 to-amber-500/10 border-yellow-500/40'
      : variant === 'approved'
        ? 'from-emerald-500/15 to-emerald-500/10 border-emerald-500/40'
        : 'from-[#D7BF75]/15 to-[#C9AE6A]/10 border-[#D7BF75]/40';

  const iconColor =
    variant === 'pending'
      ? 'text-yellow-400'
      : variant === 'approved'
        ? 'text-emerald-400'
        : 'text-[#D7BF75]';

  return (
    <div
      className={`mb-2 flex flex-col gap-3 rounded-xl border bg-gradient-to-br px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5 ${containerClasses}`}
    >
      <div className="flex items-start gap-3 sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D7BF75]/25 bg-black/40 sm:h-8 sm:w-8">
          <Shield className={`h-5 w-5 ${iconColor}`} />
        </div>
        <p className="text-sm text-[#DCDDCC]/90 sm:text-base">
          {variant === 'connect' &&
            'Connect your wallet to start verification and submit your listing.'}
          {variant === 'required' && 'Verification required to submit assets.'}
          {variant === 'pending' &&
            'Verification under review. You can continue filling your listing.'}
          {variant === 'approved' && 'You are verified to submit assets.'}
        </p>
      </div>
    </div>
  );
}

export default ListingVerificationBanner;
