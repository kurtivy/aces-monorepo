'use client';

import React from 'react';
import UpcomingCard, { type UpcomingAsset } from './upcoming-card';
import { SAMPLE_METADATA } from '@/data/metadata';

// Function to truncate description to consistent length for uniform card heights
const truncateDescription = (description: string, maxLength: number = 150): string => {
  if (description.length <= maxLength) return description;
  // Find the last space before maxLength to avoid cutting words
  const truncated = description.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const cutPoint = lastSpace > 0 ? lastSpace : maxLength;
  return description.substring(0, cutPoint).trim() + '...';
};

// Convert metadata to UpcomingAsset format
const convertMetadataToUpcomingAsset = (metadata: any): UpcomingAsset => ({
  id: metadata.id,
  title: metadata.title,
  description: truncateDescription(metadata.description),
  imageUrl: metadata.image,
  symbol: metadata.ticker,
  startDate: metadata.countdownDate, // Use the actual countdown date from metadata
  category: 'WATCH', // Default category, could be enhanced to map from metadata
});

// Get the Audemars Piguet asset from metadata (id: '7')
const upcomingAsset: UpcomingAsset = convertMetadataToUpcomingAsset(
  SAMPLE_METADATA.find((item) => item.id === '7')!,
);

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
