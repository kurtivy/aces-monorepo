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
      className={`mb-2 bg-gradient-to-br ${containerClasses} border rounded-xl px-4 py-1.5 flex items-center justify-between`}
    >
      <div className="flex items-center gap-2">
        <Shield className={`w-5 h-5 ${iconColor}`} />
        <p className="text-sm text-[#DCDDCC]/90">
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
