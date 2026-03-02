'use client';

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Footer from '@/components/ui/custom/footer';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import PageBandTitle from '@/components/ui/custom/page-band-title';
import PageBandSubtitle from '@/components/ui/custom/page-band-subtitle';
import AcesHeader from '@/components/ui/custom/aces-header';
import UpcomingGrid, { convertMetadataToUpcomingAsset } from '@/components/upcoming/upcoming-grid';
import PageLoader from '@/components/loading/page-loader';
import { SAMPLE_METADATA } from '@/data/metadata';
import type { UpcomingAsset } from '@/components/upcoming/upcoming-card';

function truncateDescription(description: string, maxLength: number = 150): string {
  if (description.length <= maxLength) return description;
  const truncated = description.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const cutPoint = lastSpace > 0 ? lastSpace : maxLength;
  return description.substring(0, cutPoint).trim() + '...';
}

/** Map Convex canvasItems doc to UpcomingAsset. Source of truth for live vs upcoming is Convex isLive. */
function convexDocToUpcomingAsset(doc: {
  id: string;
  title: string;
  description: string;
  image?: string;
  symbol?: string;
  ticker?: string;
  countdownDate?: string;
  isLive: boolean;
}): UpcomingAsset {
  const symbol = doc.symbol ?? doc.ticker ?? '';
  return {
    id: doc.id,
    title: doc.title,
    description: truncateDescription(doc.description),
    imageUrl: doc.image ?? '',
    symbol: symbol.startsWith('$') ? symbol : `$${symbol}`,
    startDate: doc.countdownDate ?? '',
    category: 'WATCH',
    comingSoon: !doc.isLive, // false → "Trade now!", true → "Coming Soon"
  };
}

function getStaticUpcomingAssets(): UpcomingAsset[] {
  const featuredMetadata = SAMPLE_METADATA.find((item) => item.id === '26');
  const banksyMetadata = SAMPLE_METADATA.find((item) => item.id === '27');
  const apMetadata = SAMPLE_METADATA.find((item) => item.id === '7');
  const featuredAsset = featuredMetadata
    ? convertMetadataToUpcomingAsset(featuredMetadata)
    : undefined;
  const banksyAsset = banksyMetadata
    ? {
        ...convertMetadataToUpcomingAsset(banksyMetadata),
        symbol: 'ILLICIT',
        comingSoon: false,
        category: 'ART',
      }
    : undefined;
  const apAsset = apMetadata ? convertMetadataToUpcomingAsset(apMetadata) : undefined;
  return [banksyAsset, featuredAsset, apAsset].filter(Boolean) as UpcomingAsset[];
}

function DropsContentWithConvex() {
  const convexItems = useQuery(api.canvasItems.listForDrops);
  const upcomingAssets = useMemo<UpcomingAsset[]>(() => {
    const assets =
      convexItems != null && convexItems.length > 0
        ? convexItems.map(convexDocToUpcomingAsset)
        : getStaticUpcomingAssets();

    return [...assets].sort((a, b) => {
      // Upcoming (comingSoon) items first, live items last
      if (a.comingSoon !== b.comingSoon) return a.comingSoon ? -1 : 1;
      // Within upcoming: soonest date first; within live: most recent date first
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
      return a.comingSoon ? dateA - dateB : dateB - dateA;
    });
  }, [convexItems]);
  return <DropsPageInner upcomingAssets={upcomingAssets} />;
}

function DropsPageInner({ upcomingAssets }: { upcomingAssets: UpcomingAsset[] }) {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
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
      <div className="relative z-50">
        <AcesHeader />
      </div>
      <LuxuryAssetsBackground
        className="absolute inset-0 z-0"
        opacity={1}
        showOnMobile={false}
        minHeight={1400}
        contentWidth={1200}
        topOffset={112}
        bandHeight={96}
      />
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
      <div className="relative z-20 h-[1400px]">
        <div className="absolute top-[200px] left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-4 sm:px-6 z-10 h-[1200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <UpcomingGrid assets={upcomingAssets} />
          <div className="h-24" />
        </div>
      </div>
      <div className="relative z-50">
        <Footer />
      </div>
    </div>
  );
}

export default function UpcomingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return <DropsPageInner upcomingAssets={getStaticUpcomingAssets()} />;
  }
  return <DropsContentWithConvex />;
}
