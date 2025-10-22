'use client';

import { useState } from 'react';
import { MapPin, X, ChevronDown } from 'lucide-react';
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
  const [openSection, setOpenSection] = useState<'Story' | 'Details' | 'Provenance'>('Story');
  const parseContent = (content?: string | null) =>
    content
      ? content
          .split(/\n+/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
      : [];

  const fallbackText = 'Additional information coming soon.';
  const cards = [
    {
      title: 'Story',
      paragraphs: parseContent(listing?.story ?? description ?? listing?.description ?? null),
    },
    {
      title: 'Details',
      paragraphs: parseContent(
        listing?.details ?? description ?? listing?.description ?? listing?.story ?? null,
      ),
    },
    {
      title: 'Provenance',
      paragraphs: parseContent(listing?.provenance ?? null),
    },
  ];

  const hasAnyCardContent = cards.some((card) => card.paragraphs.length > 0);
  const location = listing?.location || 'Worldwide';

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

      {hasAnyCardContent ? (
        <div className="flex flex-col">
          <div className="flex flex-col gap-6">
            {cards.map((card) => {
              const isOpen = openSection === card.title;
              return (
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
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenSection(card.title as 'Story' | 'Details' | 'Provenance')
                      }
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="text-base font-semibold uppercase tracking-[0.35em] text-[#D0B284] font-neue-world">
                        {card.title}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-[#D0B284] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isOpen ? (
                      card.paragraphs.length > 0 ? (
                        card.paragraphs.map((paragraph, index) => (
                          <p
                            key={`${card.title}-${index}`}
                            className="text-sm leading-relaxed text-white font-proxima-nova"
                          >
                            {paragraph}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm leading-relaxed text-white font-proxima-nova">
                          {fallbackText}
                        </p>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
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
