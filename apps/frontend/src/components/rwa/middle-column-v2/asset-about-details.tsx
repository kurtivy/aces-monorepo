'use client';

import { MapPin, X } from 'lucide-react';
import type { DatabaseListing } from '@/types/rwa/section.types';

interface AssetAboutDetailsV2Props {
  title: string;
  description?: string | null;
  onClose?: () => void;
  listing?: DatabaseListing | null;
}

export function AssetAboutDetailsV2({
  title,
  description,
  onClose,
  listing,
}: AssetAboutDetailsV2Props) {
  const descriptionParagraphs =
    description
      ?.split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean) ?? [];

  const hasDescription = descriptionParagraphs.length > 0;
  const placeholderCardBody =
    descriptionParagraphs[1] ?? descriptionParagraphs[0] ?? 'Additional information coming soon.';
  const location = listing?.location || 'Worldwide';

  const cards = [
    { title: 'Story', body: placeholderCardBody },
    { title: 'Details', body: placeholderCardBody },
    { title: 'Provenance', body: placeholderCardBody },
  ];

  return (
    <div className="relative h-full flex flex-col gap-6 bg-[#151c16] p-6">
      {onClose ? (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#D0B284] hover:text-white transition-colors"
          aria-label="Close overlay"
        >
          <X className="h-6 w-6" />
        </button>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-white font-neue-world uppercase tracking-wide">
          AUCTION DETAILS
        </h2>
        {title ? (
          <>
            <p className="mt-1 text-xs uppercase tracking-widest text-[#D0B284]/80 font-proxima-nova">
              {title}
            </p>
            <div className="flex items-center pt-1">
              <span className="text-[#D0B284]/80 text-xs font-proxima-nova uppercase tracking-widest">
                LOCATION
              </span>
              <MapPin className="w-3 h-3 text-white mx-1 flex items-center" />
              <span className="text-white text-xs font-semibold font-proxima-nova tracking-wider">
                {location}
              </span>
            </div>
          </>
        ) : null}
      </div>

      {hasDescription ? (
        <div className="flex flex-col">
          <div className="flex flex-col gap-6">
            {cards.map((card) => (
              <div
                key={card.title}
                className="relative overflow-hidden rounded-xl border border-black/10  bg-black/40 p-5 shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-5 rounded-lg bg-black/60 blur-2xl" />
                </div>

                <span className="absolute top-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute bottom-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />

                <div className="relative flex h-full flex-col gap-3">
                  <h3 className="text-base font-semibold uppercase tracking-[0.35em] text-[#D0B284] font-neue-world">
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white font-proxima-nova">
                    {card.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center border border-dashed border-[#D0B284]/20 rounded-lg p-6">
          <div className="text-[#DCDDCC] text-base md:text-lg">No description available yet</div>
          <div className="text-[#8F9B8F] text-xs md:text-sm mt-2">
            {title
              ? `Details for ${title} will be provided once the asset listing is finalized.`
              : 'Details will be provided once the asset listing is finalized.'}
          </div>
        </div>
      )}
    </div>
  );
}
