'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export interface UpcomingAsset {
  id: string;
  title: string;
  artist?: string;
  description: string;
  imageUrl: string;
  symbol: string;
  startDate: string; // ISO date string
  category: string;
  comingSoon?: boolean;
}

interface UpcomingCardProps {
  asset?: UpcomingAsset;
}

export default function UpcomingCard({ asset }: UpcomingCardProps) {
  const router = useRouter();

  const normalizedSymbol = asset?.symbol ? asset.symbol.trim().replace(/^\$/u, '') : '';
  const hasSymbol = normalizedSymbol.length > 0;
  const isComingSoon = asset?.comingSoon ?? false;
  const displaySymbol = asset?.symbol
    ? asset.symbol.startsWith('$')
      ? asset.symbol
      : `$${asset.symbol}`
    : '$TBD';
  const canNavigate = hasSymbol && !isComingSoon;

  // Truncate description to specific character length
  const truncateDescription = (text: string, maxLength: number = 132): string => {
    if (text.length <= maxLength) return text;
    // Find the last space before maxLength to avoid cutting words
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    const cutPoint = lastSpace > 0 ? lastSpace : maxLength;
    return text.substring(0, cutPoint).trim() + '...';
  };

  const handleViewAssetClick = () => {
    if (!canNavigate) return;
    router.push(`/rwa/${normalizedSymbol}`);
  };

  return (
    <div
      className={`relative pointer-events-auto ${canNavigate ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={canNavigate ? handleViewAssetClick : undefined}
    >
      {/* Card container matching the form/tokenize page styling */}
      <div className="relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(215,191,117,0.06)] hover:border-[#C9AE6A]/40 transition-all duration-300">
        {/* Bottom corner ticks only */}
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

        {/* Asset Image - Full width, no padding */}
        <div className="relative w-full h-48 mb-4 overflow-hidden">
          {isComingSoon && (
            <span className="absolute z-10 top-3 left-3 rounded-full bg-[#184D37]/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#E6E3D3]">
              Coming Soon
            </span>
          )}
          {asset?.imageUrl ? (
            <Image
              src={asset.imageUrl}
              alt={asset.title || 'Asset'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full bg-[#0f1511] flex items-center justify-center">
              <span className="text-[#C9AE6A] text-sm">No image available</span>
            </div>
          )}
        </div>

        {/* Content area with padding */}
        <div className="px-6 pb-6">
          {/* Asset Title and Symbol */}
          <div className="mb-3">
            <h3 className="text-xl font-bold text-[#D0B284] mb-1 line-clamp-1">
              {asset?.title || 'Featured Asset'}
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-[#C9AE6A] font-mono text-sm font-medium">{displaySymbol}</span>
              {asset?.category && (
                <span className="text-[#E6E3D3]/60 text-xs uppercase tracking-wide">JEWELRY</span>
              )}
            </div>
          </div>

          {/* Description - Fixed height for consistent card heights */}
          <div className="h-20 overflow-hidden mb-4">
            <p className="text-[#E6E3D3]/70 text-sm leading-relaxed">
              {asset?.description
                ? truncateDescription(asset.description)
                : 'Details coming soon...'}
            </p>
          </div>

          {/* View Asset Button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click when clicking button directly
                handleViewAssetClick();
              }}
              disabled={!canNavigate}
              className="w-full flex items-center justify-center text-[#D0B264] hover:text-[#D0B264] transition-colors duration-150 px-4 py-2 rounded-md bg-black/80 hover:bg-black/70 border border-[#D0B264]/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm font-medium uppercase tracking-wide"
            >
              {isComingSoon || !hasSymbol ? 'Coming Soon' : 'Trade now!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
