'use client';

import React from 'react';
import UpcomingCard, { type UpcomingAsset } from './upcoming-card';
import { FEATURED_TARGET_DATE } from '@/lib/constants/dates';

// Function to truncate description to consistent length for uniform card heights
const truncateDescription = (description: string, maxLength: number = 150): string => {
  if (description.length <= maxLength) return description;
  // Find the last space before maxLength to avoid cutting words
  const truncated = description.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const cutPoint = lastSpace > 0 ? lastSpace : maxLength;
  return description.substring(0, cutPoint).trim() + '...';
};

// Single upcoming asset from metadata - Audemars Piguet Royal Oak Concept KAWS
const upcomingAsset: UpcomingAsset = {
  id: '7',
  title: 'Audemars Piguet Royal Oak Concept KAWS',
  description: truncateDescription(
    `A groundbreaking collaboration between haute horology and contemporary art, this Audemars Piguet Royal Oak Concept is a limited edition masterpiece designed with the artist KAWS. The watch features KAWS's signature 'XX' motif on the tourbillon cage, housed within a futuristic titanium case.

This timepiece is not just a watch; it's a wearable sculpture that pushes the boundaries of watchmaking design. With an extremely limited production run, it's a grail piece for collectors of both high-end watches and modern art.`,
  ),
  imageUrl:
    '/canvas-images/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.webp',
  symbol: 'APKAWS',
  startDate: FEATURED_TARGET_DATE, // Use same date as featured section
  category: 'WATCH',
};

interface UpcomingGridProps {
  assets?: UpcomingAsset[];
}

export default function UpcomingGrid({ assets }: UpcomingGridProps) {
  // Use provided assets or default to single upcoming asset, applying truncation to all descriptions
  const displayAssets = assets
    ? assets.map((asset) => ({
        ...asset,
        description: truncateDescription(asset.description),
      }))
    : [upcomingAsset];
  return (
    <div className="relative pointer-events-auto">
      {/* Main grid container matching the form styling */}
      <div className="relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl p-8 shadow-[0_10px_40px_rgba(215,191,117,0.06)]">
        {/* Corner ticks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

        {/* Grid of upcoming assets - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayAssets.map((asset) => (
            <UpcomingCard key={asset.id} asset={asset} />
          ))}
        </div>
      </div>
    </div>
  );
}
