'use client';

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import Footer from '@/components/ui/custom/footer';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageBandSubtitle from '@/components/ui/custom/page-band-subtitle';
import AcesHeader from '@/components/ui/custom/aces-header';
import UpcomingGrid, { convertMetadataToUpcomingAsset } from '@/components/upcoming/upcoming-grid';
import PageLoader from '@/components/loading/page-loader';
import { SAMPLE_METADATA } from '@/data/metadata';
import type { UpcomingAsset } from '@/components/upcoming/upcoming-card';

export default function UpcomingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const upcomingAssets = useMemo<UpcomingAsset[]>(() => {
    const featuredMetadata = SAMPLE_METADATA.find((item) => item.id === '26');
    const apMetadata = SAMPLE_METADATA.find((item) => item.id === '7');

    const featuredAsset = featuredMetadata
      ? convertMetadataToUpcomingAsset(featuredMetadata)
      : undefined;
    const apAsset = apMetadata ? convertMetadataToUpcomingAsset(apMetadata) : undefined;

    return [featuredAsset, apAsset].filter(Boolean) as UpcomingAsset[];
  }, []);

  useEffect(() => {
    // Simulate initial page load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#151c16]">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-[#151c16]">
      {/* Header Component */}
      <div className="relative z-50">
        <AcesHeader />
      </div>

      {/* ACES Background + Luxury Tiles */}
      <LuxuryAssetsBackground
        className="absolute inset-0 z-0"
        opacity={1}
        showOnMobile={false}
        minHeight={1400}
        contentWidth={1200}
        topOffset={112}
        bandHeight={96}
      />

      {/* Title band between header bottom and solid horizontal line */}
      <PageBandTitle
        title="Upcoming Schedule"
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
      />
      <PageBandSubtitle
        text="See what is upcoming on the release schedule for ACES.fun. These RWA are going to be tokenized on the following date down below"
        contentWidth={1200}
        bandHeight={96}
        contentLineOffset={8}
        offsetY={12}
      />

      {/* Main Content - Fixed 1400px height for background images */}
      <div className="relative z-20 h-[1400px]">
        {/* Scrollable grid container positioned underneath text */}
        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10 h-[1200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <UpcomingGrid assets={upcomingAssets} />
          {/* Bottom padding to ensure footer clearance */}
          <div className="h-24" />
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="relative z-50">
        <Footer />
      </div>
    </div>
  );
}
